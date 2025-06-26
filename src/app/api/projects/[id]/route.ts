import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET handler để lấy thông tin chi tiết của một dự án
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        users!created_by (full_name, position, org_unit)
      `,
      )
      .eq('id', params.id)
      .single()

    if (error) {
      console.error(`Lỗi khi tải dự án ID ${params.id}:`, error)
      throw error
    }

    if (!project) {
      return NextResponse.json({ error: 'Không tìm thấy dự án' }, { status: 404 })
    }
 
    // Trả về dữ liệu được gói trong key 'project' để khớp với component frontend
    return NextResponse.json({ project })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE handler để xóa một dự án
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
    const supabase = await createClient();
    const projectId = await params;
    try {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId.id);
        if (error) throw error;
        return NextResponse.json({ message: 'Xóa dự án thành công' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
