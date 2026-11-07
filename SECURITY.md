# Security

Roadbook initially uses passwordless profiles for a trusted private installation.
Profile selection does not authenticate a person. Keep it behind a trusted LAN,
VPN, or authenticated reverse proxy; the default Compose port binds to loopback.
Do not expose it directly to the public Internet.

For a suspected vulnerability, use GitHub's private vulnerability reporting for
this repository when enabled. If unavailable, request a private reporting channel
from the maintainer without posting exploit details, personal data, or secrets in
a public issue. There is no promised response SLA or supported-version policy yet.
