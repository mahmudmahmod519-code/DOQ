#!/usr/bin/env bash
# Report-only SSH hardening check. It NEVER changes SSH settings (to avoid locking you out).
set -Euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
cfg="$(sshd -T 2>/dev/null)" || { echo "sshd not found"; exit 1; }
get() { awk -v k="$1" '$1==k {print $2}' <<<"$cfg"; }

echo "SSH port(s)            : $(get port | tr '\n' ' ')"
echo "PermitRootLogin        : $(get permitrootlogin)"
echo "PasswordAuthentication : $(get passwordauthentication)"
echo "PubkeyAuthentication   : $(get pubkeyauthentication)"
KEYS=0
for home in /root /home/*; do
  [[ -s "$home/.ssh/authorized_keys" ]] && { echo "Authorized keys        : $home/.ssh/authorized_keys ($(grep -c . "$home/.ssh/authorized_keys") key(s))"; KEYS=1; }
done
echo
echo "Recommendations (apply manually, one at a time, keeping your current session open):"
if (( KEYS == 0 )); then
  echo " 1. Add your SSH public key first:  ssh-copy-id <user>@<server>   (from your computer)"
  echo "    Do NOT disable passwords until you have logged in with the key in a second terminal."
else
  echo " 1. Open a NEW terminal and confirm you can log in with your key."
fi
echo " 2. Create a sudo user and stop logging in as root: adduser deploy && usermod -aG sudo deploy"
echo " 3. Only after 1+2 work, in /etc/ssh/sshd_config.d/99-hardening.conf set:"
echo "      PasswordAuthentication no"
echo "      PermitRootLogin prohibit-password   (or no, once the sudo user works)"
echo "    then: sshd -t && systemctl reload ssh   — and test a new login before closing your session."
echo " 4. Keep automatic security updates on: apt install unattended-upgrades"
echo " 5. If you change the SSH port, allow it first: ufw allow <port>/tcp"
