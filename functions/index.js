/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const functions = require("firebase-functions");
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

admin.initializeApp();
sgMail.setApiKey(functions.config().sendgrid.key);

const TO_EMAIL = "YOUR_GMAIL@gmail.com";
const FROM_EMAIL = "YOUR_VERIFIED_SENDER@yourdomain.com";

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.emailOnReportCreated = functions.firestore
  .document("posts/{postId}/reports/{uid}")
  .onCreate(async (snap, context) => {
    const {postId, uid} = context.params;
    const data = snap.data() || {};

    const reason = data.reason || "(no reason provided)";
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : "";

    await sgMail.send({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject: `Clean Kitchen: New report on post ${postId}`,
      text:
        "A new report was submitted.\n\n" +
        `Post ID: ${postId}\n` +
        `Reporter UID: ${uid}\n` +
        `Reason: ${reason}\n` +
        (createdAt ? `Created At: ${createdAt}\n` : ""),
    });

    return null;
  });
