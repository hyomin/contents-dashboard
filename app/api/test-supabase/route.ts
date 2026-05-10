import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: 'Supabase 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.',
        configured: false
      })
    }

    if (supabaseUrl === 'your-project-url') {
      return NextResponse.json({
        success: false,
        error: 'Supabase URL을 실제 프로젝트 URL로 변경해주세요.',
        configured: false
      })
    }

    // Supabase 연결 테스트
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 간단한 쿼리 실행 (테이블이 없어도 연결은 확인 가능)
    const { data, error } = await supabase
      .from('videos')
      .select('count')
      .limit(1)

    if (error) {
      // 테이블이 없는 경우
      if (error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          message: 'Supabase 연결 성공! 테이블을 생성해주세요.',
          configured: true,
          needsTable: true,
          error: error.message
        })
      }
      
      return NextResponse.json({
        success: false,
        error: error.message,
        configured: true
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase 연결 및 테이블 확인 완료!',
      configured: true,
      needsTable: false,
      data
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 에러',
      configured: false
    })
  }
}
