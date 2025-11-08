// helpers.js - small helper functions for frontend (placeholder)
async function getIdToken() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Not logged in");
  return await user.getIdToken();
}
