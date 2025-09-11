import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix, getExperienceScore } from '@/algorithm/experience-matrix'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  try {
    const taskId = (await params).id
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'Cần cung cấp user_id' },
        { status: 400 }
      )
    }

    // Lấy thông tin task và skills yêu cầu
    const { data: taskData } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        template_id,
        project_id,
        task_skills(skill_id, skills(name))
      `)
      .eq('id', taskId)
      .single()

    if (!taskData) {
      return NextResponse.json(
        { error: 'Không tìm thấy task' },
        { status: 404 }
      )
    }

    // Lấy thông tin user
    const { data: userData } = await supabase
      .from('users')
      .select('id, full_name, position, org_unit')
      .eq('id', userId)
      .single()

    if (!userData) {
      return NextResponse.json(
        { error: 'Không tìm thấy user' },
        { status: 404 }
      )
    }

    // Lấy skills yêu cầu từ template và task_skills
    let requiredSkills: number[] = []
    const skillNames: string[] = []

    // Từ template
    if (taskData.template_id) {
      const { data: templateData } = await supabase
        .from('task_templates')
        .select('required_skill_id, skills(name)')
        .eq('id', taskData.template_id)
        .single()

      if (templateData?.required_skill_id) {
        requiredSkills.push(templateData.required_skill_id)
        skillNames.push((templateData as any).skills?.name || 'Unknown Skill')
      }
    }

    // Từ task_skills
    if (taskData.task_skills && taskData.task_skills.length > 0) {
      const taskSkills = taskData.task_skills
        .map((ts: any) => ({
          id: ts.skill_id,
          name: ts.skills?.name || 'Unknown Skill'
        }))
        .filter((skill: any) => skill.id !== null)
      
      requiredSkills = [...new Set([...requiredSkills, ...taskSkills.map(s => s.id)])]
      skillNames.push(...taskSkills.map(s => s.name))
    }

    // Tính workload hiện tại của user (tất cả dự án)
    const { data: currentWorkloads } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        tasks!inner(
          id,
          status,
          project_id,
          projects!inner(
            id,
            name,
            status
          )
        )
      `)
      .eq('role', 'R')
      .eq('user_id', userId)
      .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])
      .in('tasks.projects.status', ['active', 'planning'])

    const currentWorkload = currentWorkloads?.length || 0
    const projectsCount = new Set(
      currentWorkloads?.map(w => (w.tasks as any).project_id) || []
    ).size

    // Xây dựng experience matrix
    const experienceMatrix = await buildExperienceMatrix([userId], requiredSkills)

    // Tính điểm cho từng skill
    const skillExperiences = requiredSkills.map((skillId, index) => {
      const score = getExperienceScore(experienceMatrix, userId, skillId)
      return {
        skill_id: skillId,
        skill_name: skillNames[index] || 'Unknown Skill',
        experience_score: score,
        level: score > 0.8 ? 'Chuyên gia' : 
               score > 0.6 ? 'Thành thạo' :
               score > 0.3 ? 'Có kinh nghiệm' :
               score > 0 ? 'Cơ bản' : 'Chưa có kinh nghiệm'
      }
    })

    // Tính các điểm thành phần
    const avgExperience = skillExperiences.length > 0 
      ? skillExperiences.reduce((sum, skill) => sum + skill.experience_score, 0) / skillExperiences.length
      : 0

    const experienceBonus = avgExperience > 0.7 ? 0.2 : avgExperience > 0.5 ? 0.1 : 0
    const fieldExperienceScore = Math.min(1, avgExperience + experienceBonus)

    // Workload score
    const maxWorkload = 3
    const workloadRatio = currentWorkload / maxWorkload
    let workloadScore = 0
    let workloadLevel = ''

    if (workloadRatio === 0) {
      workloadScore = 1.0
      workloadLevel = 'Hoàn toàn rảnh'
    } else if (workloadRatio <= 0.33) {
      workloadScore = 0.8
      workloadLevel = 'Ít việc'
    } else if (workloadRatio <= 0.66) {
      workloadScore = 0.5
      workloadLevel = 'Vừa phải'
    } else {
      workloadScore = 0.2
      workloadLevel = 'Bận'
    }

    // Skill coverage
    const skillCoverage = skillExperiences.filter(s => s.experience_score > 0).length
    const skillCoverageScore = requiredSkills.length > 0 
      ? skillCoverage / requiredSkills.length
      : 1

    // Specialization
    const hasHighExpertise = skillExperiences.some(s => s.experience_score > 0.8)
    const specializationScore = hasHighExpertise ? 1 : 0.5

    // Tổng điểm
    const totalScore = (
      fieldExperienceScore * 0.5 +
      workloadScore * 0.35 +
      skillCoverageScore * 0.1 +
      specializationScore * 0.05
    )

    // Tạo giải thích có ý nghĩa
    const reasons = []
    
    // Lý do chính - tại sao chọn người này
    if (totalScore > 0.7) {
      reasons.push(`🎯 Là ứng viên tốt nhất với tổng điểm ${Math.round(totalScore * 100)}%`)
    } else if (totalScore > 0.5) {
      reasons.push(`✅ Là lựa chọn phù hợp với tổng điểm ${Math.round(totalScore * 100)}%`)
    } else {
      reasons.push(`⚠️ Được chọn do thiếu lựa chọn tốt hơn (${Math.round(totalScore * 100)}%)`)
    }

    // Điểm mạnh cụ thể
    if (fieldExperienceScore > 0.6) {
      reasons.push(`📚 Kinh nghiệm cao trong lĩnh vực (${Math.round(fieldExperienceScore * 100)}%)`)
    } else if (fieldExperienceScore > 0.3) {
      reasons.push(`📖 Có kinh nghiệm cơ bản trong lĩnh vực (${Math.round(fieldExperienceScore * 100)}%)`)
    }

    if (workloadScore > 0.7) {
      reasons.push(`⚖️ Khả năng sẵn sàng cao (${workloadLevel})`)
    } else if (workloadScore > 0.4) {
      reasons.push(`⚖️ Có thể đảm nhận thêm (${workloadLevel})`)
    }

    if (skillCoverage === requiredSkills.length && requiredSkills.length > 0) {
      reasons.push(`✅ Đáp ứng đầy đủ ${requiredSkills.length} kỹ năng yêu cầu`)
    } else if (skillCoverage > 0) {
      reasons.push(`⚠️ Có ${skillCoverage}/${requiredSkills.length} kỹ năng cần thiết`)
    }

    if (hasHighExpertise) {
      reasons.push(`🌟 Có chuyên môn sâu trong một số kỹ năng`)
    }

    // Thông tin bổ sung hữu ích
    if (projectsCount > 1) {
      reasons.push(`🏢 Đa dạng kinh nghiệm từ ${projectsCount} dự án`)
    }

    // Tạo recommendations cho tất cả RACI roles
    const raciRecommendations = {
      R: {
        score: totalScore,
        recommendation: totalScore > 0.7 ? 'Rất phù hợp' :
                       totalScore > 0.5 ? 'Phù hợp' :
                       totalScore > 0.3 ? 'Có thể phù hợp' : 'Ít phù hợp',
        explanation: totalScore > 0.7 ? 
          'Có đủ kinh nghiệm và khả năng để thực hiện công việc một cách độc lập và hiệu quả' :
          totalScore > 0.5 ?
          'Có thể thực hiện công việc với sự hỗ trợ và giám sát phù hợp' :
          totalScore > 0.3 ?
          'Cần nhiều hỗ trợ và training để hoàn thành công việc' :
          'Không phù hợp để thực hiện công việc này'
      },
      A: {
        score: Math.min(1, totalScore + 0.1), // Accountable cần kinh nghiệm cao hơn
        recommendation: (totalScore + 0.1) > 0.7 ? 'Rất phù hợp' :
                       (totalScore + 0.1) > 0.5 ? 'Phù hợp' :
                       (totalScore + 0.1) > 0.3 ? 'Có thể phù hợp' : 'Ít phù hợp',
        explanation: (totalScore + 0.1) > 0.7 ?
          'Có đủ kinh nghiệm và uy tín để chịu trách nhiệm cuối cùng cho kết quả công việc' :
          (totalScore + 0.1) > 0.5 ?
          'Có thể chịu trách nhiệm với sự hỗ trợ từ cấp trên' :
          'Cần kinh nghiệm nhiều hơn để đảm nhận vai trò chịu trách nhiệm'
      },
      C: {
        score: Math.min(1, fieldExperienceScore + 0.2), // Consulted cần chuyên môn cao
        recommendation: (fieldExperienceScore + 0.2) > 0.7 ? 'Rất phù hợp' :
                       (fieldExperienceScore + 0.2) > 0.5 ? 'Phù hợp' :
                       (fieldExperienceScore + 0.2) > 0.3 ? 'Có thể phù hợp' : 'Ít phù hợp',
        explanation: (fieldExperienceScore + 0.2) > 0.7 ?
          'Có chuyên môn sâu để đưa ra lời khuyên và hướng dẫn chính xác' :
          (fieldExperienceScore + 0.2) > 0.5 ?
          'Có thể đóng góp ý kiến hữu ích trong lĩnh vực chuyên môn' :
          'Cần nhiều kinh nghiệm hơn để đưa ra lời khuyên đáng tin cậy'
      },
      I: {
        score: Math.min(1, workloadScore + 0.3), // Informed chỉ cần có thời gian
        recommendation: (workloadScore + 0.3) > 0.7 ? 'Rất phù hợp' :
                       (workloadScore + 0.3) > 0.5 ? 'Phù hợp' :
                       (workloadScore + 0.3) > 0.3 ? 'Có thể phù hợp' : 'Ít phù hợp',
        explanation: (workloadScore + 0.3) > 0.7 ?
          'Có đủ thời gian và khả năng để theo dõi và cập nhật tiến độ công việc' :
          (workloadScore + 0.3) > 0.5 ?
          'Có thể theo dõi công việc với tần suất phù hợp' :
          'Có thể quá bận để theo dõi công việc một cách hiệu quả'
      }
    }

    return NextResponse.json({
      user: {
        id: userData.id,
        name: userData.full_name,
        position: userData.position,
        org_unit: userData.org_unit
      },
      task: {
        id: taskData.id,
        name: taskData.name
      },
      scores: {
        total_score: Math.round(totalScore * 100),
        field_experience: Math.round(fieldExperienceScore * 100),
        workload_balance: Math.round(workloadScore * 100),
        skill_coverage: Math.round(skillCoverageScore * 100),
        specialization: Math.round(specializationScore * 100)
      },
      workload: {
        current_tasks: currentWorkload,
        projects_count: projectsCount,
        level: workloadLevel
      },
      skills: skillExperiences,
      reasons: reasons,
      raci_recommendations: raciRecommendations,
      recommendation: totalScore > 0.7 ? 'Rất phù hợp' :
                     totalScore > 0.5 ? 'Phù hợp' :
                     totalScore > 0.3 ? 'Có thể phù hợp' : 'Ít phù hợp'
    })

  } catch (error: any) {
    console.error('Error getting assignment explanation:', error)
    return NextResponse.json(
      { error: 'Không thể lấy thông tin giải thích' },
      { status: 500 }
    )
  }
}
