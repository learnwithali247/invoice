import { requireUser, deleteCustomer } from "@/lib/invoice/service";
import { handleApiError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    await deleteCustomer(user.id, id);
    return jsonOk({ id, deleted: true });
  } catch (error) {
    return handleApiError(error, "DELETE /api/customers/[id]");
  }
}
