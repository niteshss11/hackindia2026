import { itemHandler } from "../../../lib/cureledger-api";

export default function handler(req, res) {
  return itemHandler(req, res, "claims");
}
