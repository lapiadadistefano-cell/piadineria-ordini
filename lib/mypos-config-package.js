"use strict";
const crypto = require("node:crypto");

// myPOS Checkout configuration pack: base64(JSON({sid,cn,pk,pc,idx})).
function loadMyposConfigurationPackage(encoded) {
  if (typeof encoded !== "string" || !encoded.trim() || encoded.length > 30000) {
    throw Error("Missing or oversized myPOS configuration package");
  }
  const pack = encoded.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pack) || pack.length % 4 !== 0) {
    throw Error("Invalid myPOS package encoding");
  }
  let data;
  try {
    const bytes = Buffer.from(pack, "base64");
    if (bytes.toString("base64") !== pack) throw Error("Noncanonical base64");
    data = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw Error("Invalid myPOS package contents");
  }
  if (!data || typeof data !== "object" || Array.isArray(data) ||
      Object.keys(data).sort().join(",") !== "cn,idx,pc,pk,sid") {
    throw Error("Unexpected myPOS package fields");
  }
  const {sid,cn,pk,pc,idx} = data;
  if (!/^\d{1,20}$/.test(String(sid)) || !/^\d{1,20}$/.test(String(cn)) ||
      !Number.isSafeInteger(Number(idx)) || Number(idx) < 1 ||
      typeof pk !== "string" || typeof pc !== "string") {
    throw Error("Invalid myPOS package parameters");
  }
  // myPOS ships PEM text with either LF or CRLF line endings.
  let signingKey, notificationKey;
  try {
    signingKey = crypto.createPrivateKey(pk.replace(/\\r\\n/g,"\n").replace(/\\n/g,"\n"));
    notificationKey = crypto.createPublicKey(pc.replace(/\\\\r\\\\n/g,"\\n").replace(/\\\\n/g,"\\n"));
  } catch {
    throw Error("Invalid myPOS signing key or certificate");
  }
  if (signingKey.asymmetricKeyType !== "rsa" || notificationKey.asymmetricKeyType !== "rsa") {
    throw Error("myPOS requires RSA keys");
  }
  return Object.freeze({
    storeId: String(sid),
    walletNumber: String(cn),
    keyIndex: String(idx),
    privateKey: pk,
    apiPublicCertificate: pc
  });
}

module.exports = {loadMyposConfigurationPackage};
