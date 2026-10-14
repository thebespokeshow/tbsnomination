// api/host.js
// Vercel Serverless Function — handles "Host TBS" requests from colleges.
// Validates input → inserts into Supabase (host_requests) → emails Sid via Resend.

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;

// Alert recipients. Override in Vercel with TBS_NOTIFY_EMAIL (comma-separated for several).
const NOTIFY_EMAIL = (process.env.TBS_NOTIFY_EMAIL || 'siddarth1981@gmail.com').split(',').map(function (e) { return e.trim(); }).filter(Boolean);
// Sender. Override in Vercel with TBS_FROM_EMAIL once your domain is verified in Resend.
const FROM_EMAIL   = process.env.TBS_FROM_EMAIL || 'TBS Host Requests <onboarding@resend.dev>';
const TABLE_NAME   = 'host_requests';

let _supabase = null;
let _resend   = null;

function getSupabase() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY).');
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  }
  return _supabase;
}

function getResend() {
  if (!_resend) {
    if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY environment variable.');
    _resend = new Resend(RESEND_API_KEY);
  }
  return _resend;
}

function clean(val, max) {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, max || 500);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

function buildEmailHtml(d) {
  const row = (label, value) => value
    ? `<tr><td style="padding:10px 16px;font-weight:600;color:#8a8070;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:10px 16px;color:#f0ede6;font-size:14px;word-break:break-word;">${esc(value)}</td></tr>`
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>New TBS Host Request</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111111;border:1px solid rgba(201,168,76,0.25);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 36px;border-bottom:1px solid rgba(201,168,76,0.2);">
<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c;">The Bespoke Show</p>
<h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">🎓 New Host Request</h1>
<p style="margin:8px 0 0;font-size:13px;color:#8a8070;">A college wants to host TBS.</p></td></tr>
<tr><td style="padding:20px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:10px;overflow:hidden;">
${row('Institution', d.institution)}${row('City', d.city)}${row('Contact', d.contact_name)}${row('Designation', d.designation)}
${row('Email', d.email)}${row('Phone', d.phone)}${row('Timing', d.preferred_timing)}${row('Audience', d.audience_size)}${row('Topic', d.topic_interest)}${row('Message', d.message)}
</table></td></tr></table></td></tr></table></body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  const body = req.body || {};

  // Honeypot: real users never fill this hidden field. Pretend success to bots.
  if (clean(body.website)) return json(res, 200, { success: true });

  const d = {
    institution:      clean(body.institution, 200),
    city:             clean(body.city, 100),
    contact_name:     clean(body.contact_name, 150),
    designation:      clean(body.designation, 150),
    email:            clean(body.email, 200),
    phone:            clean(body.phone, 40),
    preferred_timing: clean(body.preferred_timing, 60),
    audience_size:    clean(body.audience_size, 60),
    topic_interest:   clean(body.topic_interest, 100),
    message:          clean(body.message, 2000),
  };

  const errors = [];
  if (!d.institution)  errors.push('institution is required.');
  if (!d.contact_name) errors.push('contact_name is required.');
  if (!d.email)        errors.push('email is required.');
  else if (!isValidEmail(d.email)) errors.push('email is not a valid email address.');
  if (errors.length) return json(res, 400, { error: errors.join(' '), errors });

  let insertedId = null;
  try {
    const supabase = getSupabase();
    const record = {};
    Object.keys(d).forEach((k) => { record[k] = d[k] || null; });
    const { data: inserted, error: dbError } = await supabase.from(TABLE_NAME).insert([record]).select('id').single();
    if (dbError) {
      console.error('[Supabase insert error]', dbError);
      return json(res, 500, { error: 'Failed to save your request. Please try again.', code: dbError.code || null });
    }
    insertedId = inserted && inserted.id ? inserted.id : null;
  } catch (err) {
    console.error('[Supabase client error]', err.message);
    return json(res, 500, { error: 'Could not save your request. Please try again.' });
  }

  try {
    const resend = getResend();
    const { error: emailError } = await resend.emails.send({
      from:     FROM_EMAIL,
      to:       NOTIFY_EMAIL,
      reply_to: d.email,
      subject:  `🎓 TBS host request: ${d.institution}`,
      html:     buildEmailHtml(d),
      text: [
        'NEW TBS HOST REQUEST', '====================', '',
        `Institution: ${d.institution}`, `City: ${d.city || '—'}`,
        `Contact: ${d.contact_name} (${d.designation || '—'})`,
        `Email: ${d.email}`, `Phone: ${d.phone || '—'}`,
        `Timing: ${d.preferred_timing || '—'}`, `Audience: ${d.audience_size || '—'}`,
        `Topic: ${d.topic_interest || '—'}`, '', 'Message:', d.message || '—',
      ].join('\n'),
    });
    if (emailError) console.error('[Resend email error]', emailError);
  } catch (err) {
    console.error('[Resend client error]', err.message); // non-fatal — request is saved
  }

  return json(res, 200, { success: true, id: insertedId });
};
