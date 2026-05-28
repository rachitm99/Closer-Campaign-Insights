import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let firestoreInstance: ReturnType<typeof getFirestore> | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDb() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const projectId = getRequiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const databaseId = process.env.FIREBASE_DATABASE_ID || "campaign-insights";

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  firestoreInstance = getFirestore(databaseId);
  return firestoreInstance;
}
