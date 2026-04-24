import requests
from bs4 import BeautifulSoup
import json
import time
import random
import re

# 1. 직무 분류 사전 설정 (카테고리별 키워드)
CATEGORY_KEYWORDS = {
    "기획/전략": ["AE", "AP", "캠페인 플래너", "매체 전략", "브랜드 기획", "기획", "전략"],
    "크리에이티브": ["카피라이터", "아트디렉터", "광고 디자인", "영상 PD", "모션 그래픽", "디자이너", "PD"],
    "퍼포먼스": ["퍼포먼스 마케팅", "미디어 바잉", "데이터 분석", "ROAS", "퍼포먼스 마케터", "그로스", "바잉"],
    "소셜/콘텐츠": ["SNS 에디터", "콘텐츠 마케터", "인플루언서 마케팅", "바이럴", "블로그 운영", "SNS", "콘텐츠"],
    "테크/AI": ["마케팅 엔지니어", "AI 프롬프트 엔지니어", "GA4", "마케팅 자동화", "개발", "엔지니어"]
}

# 브라우저처럼 보이기 위한 User-Agent 리스트
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
]

def get_category(title):
    """제목을 분석하여 직무 카테고리를 분류하는 함수 (다중 매칭 시 첫 번째 발견된 것 반환)"""
    title_upper = title.upper()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.upper() in title_upper:
                return category
    return "기타" # 매칭되는 키워드가 없을 경우

def crawl_jobkorea():
    """잡코리아에서 '광고 대행사' 키워드로 공고 수집"""
    print("[잡코리아] 수집 시작...")
    url = "https://www.jobkorea.co.kr/Search/?stext=광고%20대행사"
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 실제 사이트 구조에 맞춘 셀렉터 (구조가 변경될 수 있음)
        job_list = soup.select('.list-post .post')
        results = []
        
        for job in job_list:
            try:
                company = job.select_one('.name').text.strip()
                title = job.select_one('.title').text.strip()
                exp = job.select_one('.exp').text.strip()
                loc = job.select_one('.loc').text.strip()
                deadline = job.select_one('.date').text.strip()
                link = "https://www.jobkorea.co.kr" + job.select_one('.title')['href']
                
                results.append({
                    "company": company,
                    "title": title,
                    "category": get_category(title),
                    "experience": [exp], # 앱 데이터 형식에 맞춤
                    "location": loc,
                    "deadline": deadline,
                    "url": link,
                    "techStack": [], # 크롤링 시점에는 빈값 처리
                    "isMember": False # 초기값
                })
            except Exception as e:
                continue
        return results
    except Exception as e:
        print(f"[잡코리아] 에러: {e}")
        return []

def crawl_saramin():
    """사람인에서 '광고 대행사' 키워드로 공고 수집"""
    print("[사람인] 수집 시작...")
    url = "https://www.saramin.co.kr/zf_user/search?searchword=광고%20대행사"
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 실제 사이트 구조에 맞춘 셀렉터
        job_list = soup.select('.item_recruit')
        results = []
        
        for job in job_list:
            try:
                company = job.select_one('.corp_name a').text.strip()
                title = job.select_one('.job_tit a').text.strip()
                condition = job.select('.job_condition span')
                loc = condition[0].text.strip()
                exp = condition[1].text.strip()
                deadline = job.select_one('.date').text.strip()
                link = "https://www.saramin.co.kr" + job.select_one('.job_tit a')['href']
                
                results.append({
                    "company": company,
                    "title": title,
                    "category": get_category(title),
                    "experience": [exp],
                    "location": loc,
                    "deadline": deadline,
                    "url": link,
                    "techStack": [],
                    "isMember": False
                })
            except Exception as e:
                continue
        return results
    except Exception as e:
        print(f"[사람인] 에러: {e}")
        return []

def save_to_json(data):
    """수집된 데이터를 jobs.json 파일로 저장"""
    file_path = "jobs.json"
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"\n[성공] 총 {len(data)}건의 데이터가 {file_path}에 저장되었습니다.")
    except Exception as e:
        print(f"저장 에러: {e}")

if __name__ == "__main__":
    # 1. 데이터 수집
    jobkorea_results = crawl_jobkorea()
    time.sleep(random.uniform(2, 4)) # 차단 방지를 위한 간격
    saramin_results = crawl_saramin()
    
    # 2. 통합
    all_results = jobkorea_results + saramin_results
    
    # 3. 저장
    if all_results:
        save_to_json(all_results)
    else:
        print("수집된 데이터가 없습니다. 사이트 구조 변경 여부를 확인해주세요.")
