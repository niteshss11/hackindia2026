import { collectionHandler } from "../../lib/cureledger-api";

export default function handler(req, res) {
  return collectionHandler(req, res, "audit");
}
