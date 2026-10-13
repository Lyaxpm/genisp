import { NextRequest } from "next/server";
import { masterList, masterCreate, type MasterDef } from "../_lib";

export const dynamic = "force-dynamic";

const DEF: MasterDef = {
  table: "banks",
  label: "Bank",
  fields: ["name", "no_rek", "owner"],
  bools: ["is_active"],
  required: ["name"],
  searchFields: ["name", "no_rek", "owner"],
  order: "order by is_active desc, name asc",
};

export async function GET(req: NextRequest) {
  return masterList(DEF, req);
}

export async function POST(req: NextRequest) {
  return masterCreate(DEF, req);
}
