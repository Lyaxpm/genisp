import { NextRequest } from "next/server";
import { masterGet, masterUpdate, masterDelete, type MasterDef } from "../../_lib";

export const dynamic = "force-dynamic";

const DEF: MasterDef = {
  table: "payment_methods",
  label: "Metode pembayaran",
  fields: ["name", "remark"],
  protectSystem: true,
};

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return masterGet(DEF, params.id);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return masterUpdate(DEF, req, params.id);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return masterDelete(DEF, params.id);
}
