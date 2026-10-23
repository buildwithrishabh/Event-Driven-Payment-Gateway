import dns from "node:dns/promises";
import net from "node:net";

// RFC1918, RFC6598, RFC5737, RFC3927 (AWS metadata), Loopback ranges
const PRIVATE_IP_RANGES = [
  /^127\./,                         // IPv4 Loopback (127.0.0.0/8)
  /^10\./,                          // RFC1918 Class A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC1918 Class B (172.16.0.0/12)
  /^192\.168\./,                    // RFC1918 Class C (192.168.0.0/16)
  /^169\.254\./,                    // Link-local / Cloud Metadata (169.254.0.0/16)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
  /^0\./,                           // Current network
  /^::1$/,                          // IPv6 Loopback
  /^fc00:/i,                        // IPv6 Unique Local
  /^fe80:/i,                        // IPv6 Link-Local
];

export function isPrivateOrReservedIP(ip) {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

export async function validateWebhookUrl(urlString) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error("Invalid URL format");
  }

  // 1. Only allow HTTPS (production) or HTTP (strictly local dev testing)
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && parsedUrl.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS in production");
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new Error("Invalid protocol. Only HTTP(S) allowed.");
  }

  // 2. Reject credentials in URL (e.g. https://user:pass@example.com)
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("Credentials in webhook URL are forbidden");
  }

  // 3. Block suspicious hostnames
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Local/Internal hostnames are not allowed");
  }

  // 4. If hostname is raw IP, check immediately
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new Error("Private or loopback IP addresses are not allowed");
    }
    return true;
  }

  // 5. DNS Resolution check (Check what IP domain resolves to)
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const record of addresses) {
      if (isPrivateOrReservedIP(record.address)) {
        throw new Error(
          `Domain resolves to restricted/internal IP: ${record.address}`
        );
      }
    }
  } catch (err) {
    if (err.message.includes("restricted/internal IP")) throw err;
    throw new Error("Unable to resolve webhook hostname via DNS");
  }

  return true;
}
