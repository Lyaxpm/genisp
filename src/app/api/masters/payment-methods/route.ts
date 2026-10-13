import { NextRequest } from "next/server";
import { masterList, masterCreate, type MasterDef } from "../_lib";

export const dynamic = "force-dynamic";

const DEF: MasterDef = {
  table: "payment_methods",
  label: "Metode pembayaran",
  fields: ["name", "remark"],
  bools: [],
  protectSystem: true,
  required: ["name"],
  searchFields: ["name", "remark"],
  order: "order by is_system desc, name asc",
};

export async function GET(req: NextRequest) {
  return masterList(DEF, req);
}

export async function POST(req: NextRequest) {
  return masterCreate(DEF, req);
}
