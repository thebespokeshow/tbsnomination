// api/nomination.js
// Vercel Serverless Function — handles TBS nomination submissions.
// Validates input → inserts into Supabase → sends Resend email notification.

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { Resend }       = require('resend');

/* ─── Environment Variables ────────────────────────────────────────── */
const SUPABASE_URL         = process.env.SUPABASE_URL;
// Prefer the service-role key (bypasses RLS — safe here because this code
// runs server-side only and is never sent to the browser).
// Fall back to SUPABASE_ANON_KEY only if the service key is not configured,
// but note that RLS must then have an INSERT policy for the anon role.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;

const NOTIFY_EMAIL  = 'siddarth1981@gmail.com';
const FROM_EMAIL    = 'TBS Nominations <onboarding@resend.dev>'; // swap to your verified domain once ready
const TABLE_NAME    = 'nominations';

/* ─── Lazy singletons (reused across warm invocations) ─────────────── */
let _supabase = null;
let _resend   = null;

function getSupabase() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error(
        'Missing Supabase environment variables. ' +
        'Set SUPABASE_URL and SUPABASE_SERVICE_KEY (service-role key) in your Vercel project.'
      );
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

function getResend() {
  if (!_resend) {
    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable.');
    }
    _resend = new Resend(RESEND_API_KEY);
  }
  return _resend;
}

/* ─── Helpers ──────────────────────────────────────────────────────── */
function sanitize(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(body);
}

/* ─── Email HTML builder ────────────────────────────────────────────── */
function buildEmailHtml(data) {
  const row = (label, value) =>
    value
      ? `<tr>
           <td style="padding:10px 16px;font-weight:600;color:#8a8070;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
           <td style="padding:10px 16px;color:#f0ede6;font-size:14px;word-break:break-word;">${value}</td>
         </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New TBS Nomination</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111111;border:1px solid rgba(201,168,76,0.25);border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1400,#111111);padding:32px 36px;border-bottom:1px solid rgba(201,168,76,0.2);">
              <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:#c9a84c;">
                The Bespoke Show
              </p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">
                🏆 New Nomination Received
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#8a8070;">
                A new nomination has been submitted through the TBS Nomination Form.
              </p>
            </td>
          </tr>

          <!-- Nominee Section -->
          <tr>
            <td style="padding:28px 36px 4px;">
              <p style="margin:0;font-size:10.5px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;border-bottom:1px solid rgba(201,168,76,0.2);padding-bottom:10px;">
                About the Nominee
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:10px;overflow:hidden;">
                ${row('Name',       data.nominee_name)}
                ${row('Role',       data.nominee_role)}
                ${row('Domain',     data.nominee_domain)}
                ${row('WhatsApp',   data.nominee_whatsapp)}
                ${row('LinkedIn',   data.nominee_linkedin
                  ? `<a href="${data.nominee_linkedin}" style="color:#c9a84c;text-decoration:none;">${data.nominee_linkedin}</a>`
                  : '')}
              </table>
            </td>
          </tr>

          <!-- Reason -->
          <tr>
            <td style="padding:0 36px 16px;">
              <p style="margin:0 0 8px;font-size:10.5px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;">
                Reason for Nomination
              </p>
              <div style="background:#1a1a1a;border-radius:10px;padding:16px;font-size:14px;color:#f0ede6;line-height:1.7;white-space:pre-wrap;">
                ${data.nomination_reason}
              </div>
            </td>
          </tr>

          <!-- Nominator Section -->
          <tr>
            <td style="padding:8px 36px 4px;">
              <p style="margin:0;font-size:10.5px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#c9a84c;border-bottom:1px solid rgba(201,168,76,0.2);padding-bottom:10px;">
                Submitted By
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:10px;overflow:hidden;">
                ${row('Name',  data.nominator_name)}
                ${row('Email', `<a href="mailto:${data.nominator_email}" style="color:#c9a84c;text-decoration:none;">${data.nominator_email}</a>`)}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0d0d0d;padding:20px 36px;border-top:1px solid rgba(201,168,76,0.1);text-align:center;">
              <p style="margin:0;font-size:12px;color:#3a3530;">
                © ${new Date().getFullYear()} The Bespoke Show &nbsp;·&nbsp; This is an automated notification.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ─── Main Handler ─────────────────────────────────────────────────── */
module.exports = async function handler(req, res) {
  /* Only POST allowed */
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  /* ── 1. Parse & sanitize input ───────────────────────────────── */
  const body = req.body || {};

  const nominee_name      = sanitize(body.nominee_name);
  const nominee_role      = sanitize(body.nominee_role);
  const nominee_domain    = sanitize(body.nominee_domain);
  const nominee_whatsapp  = sanitize(body.nominee_whatsapp);
  const nominee_linkedin  = sanitize(body.nominee_linkedin);
  const nomination_reason = sanitize(body.nomination_reason);
  const nominator_name    = sanitize(body.nominator_name);
  const nominator_email   = sanitize(body.nominator_email);

  /* ── 2. Server-side validation ───────────────────────────────── */
  const errors = [];

  if (!nominee_name)      errors.push('nominee_name is required.');
  if (!nomination_reason) errors.push('nomination_reason is required.');
  if (!nominator_name)    errors.push('nominator_name is required.');
  if (!nominator_email)   errors.push('nominator_email is required.');
  else if (!isValidEmail(nominator_email)) errors.push('nominator_email is not a valid email address.');

  if (errors.length > 0) {
    return json(res, 400, { error: errors.join(' '), errors });
  }

  /* ── 3. Insert into Supabase ──────────────────────────────────── */
  let insertedId = null;

  try {
    const supabase = getSupabase();

    const record = {
      nominee_name,
      nominee_role:      nominee_role      || null,
      nominee_domain:    nominee_domain    || null,
      nominee_whatsapp:  nominee_whatsapp  || null,
      nominee_linkedin:  nominee_linkedin  || null,
      nomination_reason,
      nominator_name,
      nominator_email,
    };

    const { data: inserted, error: dbError } = await supabase
      .from(TABLE_NAME)
      .insert([record])
      .select('id')
      .single();

    if (dbError) {
      console.error('[Supabase insert error]', dbError);
      return json(res, 500, { error: 'Failed to save nomination. Please try again.' });
    }

    insertedId = inserted?.id ?? null;
    console.log(`[nomination saved] id=${insertedId} nominee="${nominee_name}"`);

  } catch (err) {
    console.error('[Supabase client error]', err.message);
    return json(res, 500, { error: err.message || 'Database error. Please try again.' });
  }

  /* ── 4. Send Resend email notification ────────────────────────── */
  try {
    const resend = getResend();

    const emailData = {
      nominee_name,
      nominee_role,
      nominee_domain,
      nominee_whatsapp,
      nominee_linkedin,
      nomination_reason,
      nominator_name,
      nominator_email,
    };

    const { error: emailError } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [NOTIFY_EMAIL],
      subject: `✦ New TBS Nomination: ${nominee_name}`,
      html:    buildEmailHtml(emailData),
      // Plain-text fallback
      text: [
        'NEW TBS NOMINATION',
        '==================',
        '',
        'NOMINEE',
        `Name:      ${nominee_name}`,
        `Role:      ${nominee_role      || '—'}`,
        `Domain:    ${nominee_domain    || '—'}`,
        `WhatsApp:  ${nominee_whatsapp  || '—'}`,
        `LinkedIn:  ${nominee_linkedin  || '—'}`,
        '',
        'REASON FOR NOMINATION',
        nomination_reason,
        '',
        'SUBMITTED BY',
        `Name:  ${nominator_name}`,
        `Email: ${nominator_email}`,
      ].join('\n'),
    });

    if (emailError) {
      // Log but don't fail the request — nomination is already saved.
      console.error('[Resend email error]', emailError);
    } else {
      console.log(`[email sent] to=${NOTIFY_EMAIL} nominee="${nominee_name}"`);
    }

  } catch (err) {
    // Non-fatal — nomination is saved, just notify admins.
    console.error('[Resend client error]', err.message);
  }

  /* ── 5. Success response ──────────────────────────────────────── */
  return json(res, 200, {
    success:  true,
    message:  `Nomination for ${nominee_name} received successfully.`,
    id:       insertedId,
  });
};
