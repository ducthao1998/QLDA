import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(
  request: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  try {
    const supabase = await createClient()
    const { id, phaseId } = await params
    const body = await request.json()

    // Check if the new order_no is already taken
    const { data: existingPhase } = await supabase
      .from("project_phases")
      .select("id, order_no")
      .eq("project_id", id)
      .eq("order_no", body.order_no)
      .neq("id", phaseId)
      .single()

    if (existingPhase) {
      // Swap order numbers
      const { error: swapError } = await supabase
        .from("project_phases")
        .update({ order_no: existingPhase.order_no })
        .eq("id", phaseId)
        .eq("project_id", id)

      if (swapError) {
        console.error("Error swapping order numbers:", swapError)
        return NextResponse.json({ error: swapError.message }, { status: 500 })
      }

      const { error: updateError } = await supabase
        .from("project_phases")
        .update({ order_no: body.order_no })
        .eq("id", existingPhase.id)
        .eq("project_id", id)

      if (updateError) {
        console.error("Error updating swapped phase:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    // Update the phase with new data
    const { data, error } = await supabase
      .from("project_phases")
      .update({
        name: body.name,
        description: body.description,
        order_no: body.order_no,
        updated_at: new Date().toISOString()
      })
      .eq("id", phaseId)
      .eq("project_id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating phase:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ phase: data })
  } catch (error) {
    console.error("Error in PUT /api/projects/[id]/phases/[phaseId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  try {
    const supabase = await createClient()
    const { id, phaseId } = await params

    const { error } = await supabase
      .from("project_phases")
      .delete()
      .eq("id", phaseId)
      .eq("project_id", id)

    if (error) {
      console.error("Error deleting phase:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/projects/[id]/phases/[phaseId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 