import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * Lấy danh sách các công việc mà một công việc khác phụ thuộc vào.
 */
export async function GET(request: Request, ctx: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await ctx.params
    
    // SỬA LỖI: Chỉ định rõ ràng mối quan hệ khóa ngoại cần sử dụng.
    // Chúng ta muốn lấy thông tin của công việc được tham chiếu bởi cột `depends_on_id`.
    const { data, error } = await supabase
      .from("task_dependencies")
      .select(`
        id,
        depends_on_id,
        dependency_task: tasks!task_dependencies_depends_on_id_fkey (
          id,
          name,
          status
        )
      `)
      .eq("task_id", id)

    if (error) {
      console.error("Lỗi Supabase khi lấy dependencies:", error)
      throw error
    }

    const dependenciesWithProgress = (data || []).map((dep: any) => {
      let progressPercentage = 0
      const depTask = dep.dependency_task

      if (depTask) {
        switch (depTask.status) {
          case "done":
          case "completed":
            progressPercentage = 100
            break
          case "in_progress":
            progressPercentage = 50
            break
          case "review":
            progressPercentage = 80
            break
          default:
            progressPercentage = 0
        }
      }

      return {
        id: dep.id,
        depends_on_id: dep.depends_on_id,
        dependency_task: depTask ? { ...depTask, progress_percentage: progressPercentage } : null,
      }
    })

    return NextResponse.json({
      dependencies: dependenciesWithProgress,
    })

  } catch (error) {
    console.error("Lỗi trong API dependencies:", error)
    return NextResponse.json({ error: "Không thể lấy danh sách phụ thuộc" }, { status: 500 })
  }
}

/**
 * Đồng bộ hóa (xóa cũ, thêm mới) danh sách phụ thuộc cho một công việc.
 */
export async function POST(request: Request, ctx: { params: { id: string } }) {
  const supabase = await createClient()
  const { id: taskId } = await ctx.params // ID của công việc đang được chỉnh sửa
  const body = await request.json()

  try {
    // Chấp nhận cả hai định dạng payload từ client.
    let depends_on_ids: string[] = [];

    if (body.dependencies && Array.isArray(body.dependencies)) {
      depends_on_ids = body.dependencies;
    } else if (body.depends_on_id) {
      depends_on_ids = [body.depends_on_id];
    } else {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ, body cần chứa 'dependencies' (mảng) hoặc 'depends_on_id' (chuỗi)." }, { status: 400 })
    }

    // Logic kiểm tra phụ thuộc chéo
    if (depends_on_ids.length > 0) {
        const { data: reverseDeps, error: checkError } = await supabase
            .from('task_dependencies')
            .select('task_id')
            .in('task_id', depends_on_ids)
            .eq('depends_on_id', taskId);
        
        if (checkError) throw checkError;

        if (reverseDeps && reverseDeps.length > 0) {
            return NextResponse.json({ error: `Thao tác không hợp lệ. Một trong các công việc được chọn đã phụ thuộc vào công việc này.` }, { status: 409 });
        }
    }

    // Bước 1: Xóa tất cả các phụ thuộc cũ.
    const { error: deleteError } = await supabase.from("task_dependencies").delete().eq("task_id", taskId);
    if (deleteError) throw deleteError;

    if (depends_on_ids.length === 0) {
        return NextResponse.json({ message: "Đã xóa tất cả phụ thuộc thành công." });
    }

    // Bước 2: Chuẩn bị dữ liệu mới.
    const dependenciesToInsert = depends_on_ids.map((depends_on_id: string) => {
        if (taskId === depends_on_id) {
            throw new Error("Một công việc không thể tự phụ thuộc vào chính nó.");
        }
        return {
            task_id: taskId,
            depends_on_id: depends_on_id,
        };
    });

    // Bước 3: Chèn các phụ thuộc mới.
    const { error: insertError } = await supabase.from("task_dependencies").insert(dependenciesToInsert);

    if (insertError) {
        console.error("Supabase Insert Error:", insertError);
        throw insertError;
    }

    return NextResponse.json({ success: true, message: "Cập nhật phụ thuộc thành công." });

  } catch (error: any) {
    console.error("--- ERROR ADDING DEPENDENCY ---");
    console.error("Task ID:", taskId);
    console.error("Request Body:", JSON.stringify(body, null, 2));
    console.error("Full Error Object:", error);
    console.error("-------------------------------");

    if (error.message.includes("không thể tự phụ thuộc vào chính nó")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    if (error.code === '23503') {
        return NextResponse.json({ error: "Thao tác không hợp lệ. Một trong các công việc phụ thuộc không tồn tại." }, { status: 400 });
    }

    return NextResponse.json({ 
        error: "Không thể thêm phụ thuộc do lỗi server.",
        details: error.message 
    }, { status: 500 });
  }
}

/**
 * Xóa tất cả các phụ thuộc của một công việc.
 */
export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await ctx.params

  try {
    const { error } = await supabase
      .from("task_dependencies")
      .delete()
      .eq("task_id", id)

    if (error) throw error

    return NextResponse.json({ success: true, message: "Đã xóa tất cả phụ thuộc." })
  } catch (error: any) {
    console.error("Lỗi khi xóa phụ thuộc:", error)
    return NextResponse.json({ error: "Không thể xóa phụ thuộc của công việc." }, { status: 500 })
  }
}
