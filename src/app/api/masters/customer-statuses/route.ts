import { NextRequest } from "next/server";
import { masterList, masterCreate, type MasterDef } from "../_lib";

export const dynamic = "force-dynamic";

const DEF: MasterDef = {
  table: "customer_statuses",
  label: "Status pelanggan",
  fields: ["status", "remark"],
  bools: ["active_bill"],
  required: ["status"],
  searchFields: ["status", "remark"],
  order: "order by id asc",
};

export async function GET(req: NextRequest) {
  return masterList(DEF, req);
}

export async function POST(req: NextRequest) {
  return masterCreate(DEF, req);
}
