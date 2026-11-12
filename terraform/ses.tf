# Outbound: SES sends as fbrissi.dev with Easy DKIM and a custom MAIL FROM subdomain, so SPF and DKIM align with the
# domain. The identity was created by oliblish-dev/nota-profile and is imported here with its MAIL FROM.
import {
  to = aws_sesv2_email_identity.domain
  id = local.custom_domain
}

import {
  to = aws_sesv2_email_identity_mail_from_attributes.domain
  id = local.custom_domain
}

resource "aws_sesv2_email_identity" "domain" {
  email_identity = local.custom_domain
}

resource "cloudflare_dns_record" "ses_dkim" {
  # Easy DKIM always issues three tokens.
  count   = 3
  zone_id = local.cloudflare_zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.custom_domain}"
  content = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"
  type    = "CNAME"
  proxied = false
  ttl     = 1
}

resource "aws_sesv2_email_identity_mail_from_attributes" "domain" {
  email_identity         = aws_sesv2_email_identity.domain.email_identity
  mail_from_domain       = "mail.${local.custom_domain}"
  behavior_on_mx_failure = "REJECT_MESSAGE"
  depends_on             = [cloudflare_dns_record.ses_mail_from_mx, cloudflare_dns_record.ses_mail_from_spf]
}

resource "cloudflare_dns_record" "ses_mail_from_mx" {
  zone_id  = local.cloudflare_zone_id
  name     = "mail.${local.custom_domain}"
  content  = "feedback-smtp.${local.aws_region}.amazonses.com"
  type     = "MX"
  priority = 10
  ttl      = 1
}

resource "cloudflare_dns_record" "ses_mail_from_spf" {
  zone_id = local.cloudflare_zone_id
  name    = "mail.${local.custom_domain}"
  content = "\"v=spf1 include:amazonses.com -all\""
  type    = "TXT"
  ttl     = 1
}
