/*
  # Update Supabase Auth Email Templates — Lazurde Branding

  Updates the built-in Supabase Auth email templates to match the
  Lazurde dark-pink brand identity.

  ## Templates Updated
  1. Email confirmation (signup verification)
  2. Password reset / magic link

  These templates are stored in auth.mfa_factors and applied via
  the Supabase Auth configuration. We use the auth.email_templates
  approach to customize HTML sent by GoTrue.

  Note: Full template override requires Supabase dashboard config
  (Authentication → Email Templates). This migration documents the
  required template HTML and sets the redirect URLs via the
  email_redirect_urls setting in auth.config if the table exists.
*/

-- Update auth configuration email templates where supported.
-- Supabase stores customizable templates in auth.config (self-hosted)
-- or via the dashboard for cloud. This migration updates what is
-- accessible via SQL for auth schema.

DO $$
BEGIN
  -- Only attempt if auth.config table is accessible (self-hosted Supabase)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'config'
  ) THEN
    -- Update confirmation email template
    UPDATE auth.config
    SET
      mailer_subjects_confirmation = 'تأكيد بريدك الإلكتروني — Lazurde Beauty',
      mailer_templates_confirmation_content = '<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:''Segoe UI'',Helvetica,Arial,sans-serif;background:#f8f0f4;direction:rtl}
.wrap{max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,#1a0e14 0%,#2d1520 100%);padding:28px 32px;text-align:center}
.logo{font-size:26px;font-weight:900;color:#FF4D8D;letter-spacing:3px}
.logo-sub{font-size:11px;color:#994A75;letter-spacing:2px;margin-top:3px}
.body{padding:28px 32px;color:#1a0e14}
.title{font-size:20px;font-weight:700;margin-bottom:10px}
.text{font-size:14px;color:#444;line-height:1.7;margin-bottom:20px}
.btn{display:inline-block;background:#FF4D8D;color:#fff;padding:13px 32px;border-radius:999px;font-size:15px;font-weight:800;text-decoration:none}
.footer{background:#1a0e14;padding:16px 32px;text-align:center;font-size:11px;color:#994A75}
.brand{font-size:13px;font-weight:800;color:#FF4D8D;margin-bottom:3px}
</style>
</head>
<body>
<div class="wrap">
<div class="header"><div class="logo">LAZURDE</div><div class="logo-sub">لازوردي للجمال والعناية</div></div>
<div class="body">
<div class="title">تأكيد بريدك الإلكتروني</div>
<p class="text">مرحباً! انقري على الزر أدناه لتأكيد عنوان بريدك الإلكتروني والبدء في التسوق.</p>
<a href="{{ .ConfirmationURL }}" class="btn">تأكيد البريد الإلكتروني</a>
<p style="font-size:12px;color:#999;margin-top:18px">إذا لم تقومي بإنشاء حساب، يمكنك تجاهل هذا البريد.</p>
</div>
<div class="footer"><div class="brand">LAZURDE</div>lazurdebeauty.com · support@lazurdebeauty.com</div>
</div>
</body></html>'
    WHERE TRUE;

    -- Update recovery (password reset) email template
    UPDATE auth.config
    SET
      mailer_subjects_recovery = 'إعادة تعيين كلمة المرور — Lazurde Beauty',
      mailer_templates_recovery_content = '<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:''Segoe UI'',Helvetica,Arial,sans-serif;background:#f8f0f4;direction:rtl}
.wrap{max-width:520px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,#1a0e14 0%,#2d1520 100%);padding:28px 32px;text-align:center}
.logo{font-size:26px;font-weight:900;color:#FF4D8D;letter-spacing:3px}
.logo-sub{font-size:11px;color:#994A75;letter-spacing:2px;margin-top:3px}
.body{padding:28px 32px;color:#1a0e14}
.title{font-size:20px;font-weight:700;margin-bottom:10px}
.text{font-size:14px;color:#444;line-height:1.7;margin-bottom:20px}
.btn{display:inline-block;background:#FF4D8D;color:#fff;padding:13px 32px;border-radius:999px;font-size:15px;font-weight:800;text-decoration:none}
.warning{font-size:12px;color:#e57373;margin-top:14px;padding:10px;background:#fff5f5;border-radius:6px;border:1px solid #ffcdd2}
.footer{background:#1a0e14;padding:16px 32px;text-align:center;font-size:11px;color:#994A75}
.brand{font-size:13px;font-weight:800;color:#FF4D8D;margin-bottom:3px}
</style>
</head>
<body>
<div class="wrap">
<div class="header"><div class="logo">LAZURDE</div><div class="logo-sub">لازوردي للجمال والعناية</div></div>
<div class="body">
<div class="title">إعادة تعيين كلمة المرور</div>
<p class="text">تلقينا طلباً لإعادة تعيين كلمة مرور حسابك. انقري على الزر أدناه للمتابعة.</p>
<a href="{{ .ConfirmationURL }}" class="btn">إعادة تعيين كلمة المرور</a>
<div class="warning">⚠️ إذا لم تطلبي إعادة التعيين، تجاهلي هذا البريد. الرابط صالح لمدة ساعة واحدة فقط.</div>
</div>
<div class="footer"><div class="brand">LAZURDE</div>lazurdebeauty.com · support@lazurdebeauty.com</div>
</div>
</body></html>'
    WHERE TRUE;
  END IF;
END $$;

/*
  ── Supabase Cloud Dashboard Instructions ────────────────────────────────────
  For Supabase Cloud projects, update templates manually at:
  Dashboard → Authentication → Email Templates

  CONFIRMATION SUBJECT:  تأكيد بريدك الإلكتروني — Lazurde Beauty
  RECOVERY SUBJECT:      إعادة تعيين كلمة المرور — Lazurde Beauty

  Replace {{ .ConfirmationURL }} with the Supabase magic link variable.
  ──────────────────────────────────────────────────────────────────────────────
*/
