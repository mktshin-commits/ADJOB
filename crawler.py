import requests
from bs4 import BeautifulSoup
import json
import time
import random
import re

# 1. 직무 분류 사전 설정 (카테고리별 키워드)
CATEGORY_KEYWORDS = {
    "기획/전략": ["AE", "AP", "캠페인 플래너", "매체 전략", "브랜드 기획", "기획", "전략", "플래닝"],
    "크리에이티브": ["카피라이터", "아트디렉터", "광고 디자인", "영상 PD", "모션 그래픽", "디자이너", "PD", "아트"],
    "퍼포먼스": ["퍼포먼스 마케팅", "미디어 바잉", "데이터 분석", "ROAS", "퍼포먼스 마케터", "그로스", "바잉", "GA4"],
    "소셜/콘텐츠": ["SNS 에디터", "콘텐츠 마케터", "인플루언서 마케팅", "바이럴", "블로그 운영", "SNS", "콘텐츠", "커뮤니케이션"],
    "테크/AI": ["마케팅 엔지니어", "AI 프롬프트 엔지니어", "GA4", "마케팅 자동화", "개발", "엔지니어", "IT", "테크"]
}

# 브라우저처럼 보이기 위한 User-Agent 리스트
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
]

# 확장된 검색 키워드 리스트
SEARCH_KEYWORDS = ["광고 대행사", "디지털 대행사", "미디어렙", "퍼포먼스 마케팅", "종합 광고 대행사"]

def get_category(title):
    """제목을 분석하여 직무 카테고리를 분류하는 함수 (다중 매칭 시 첫 번째 발견된 것 반환)"""
    title_upper = title.upper()
    matched = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.upper() in title_upper:
                matched.append(category)
                break
    return matched if matched else ["기타"]

def crawl_jobkorea(keyword):
    """잡코리아에서 키워드로 공고 수집 (최신 셀렉터 반영)"""
    print(f"[잡코리아] '{keyword}' 수집 시작...")
    url = f"https://www.jobkorea.co.kr/Search/?stext={keyword}"
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 최신 카드형 레이아웃 셀렉터 반영
        job_list = soup.select('.post-list-info') or soup.select('.list-post .post')
        results = []
        
        for job in job_list:
            try:
                # 기업명
                company_el = job.select_one('.post-list-corp a') or job.select_one('.name a')
                company = company_el.text.strip()
                
                # 제목 및 링크
                title_el = job.select_one('.information-title a') or job.select_one('.title a')
                title = title_el.text.strip()
                link = "https://www.jobkorea.co.kr" + title_el['href']
                
                # 부가 정보 (경력, 지역, 마감일)
                exp = job.select_one('.experience').text.strip() if job.select_one('.experience') else "경력무관"
                loc = job.select_one('.location').text.strip() if job.select_one('.location') else "전국"
                deadline = job.select_one('.date').text.strip() if job.select_one('.date') else "상시채용"
                
                results.append({
                    "platform": "JobKorea",
                    "company": company,
                    "title": title,
                    "matchedCategories": get_category(title),
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
        print(f"[잡코리아] 에러: {e}")
        return []

def crawl_saramin(keyword):
    """사람인에서 키워드로 공고 수집 (최신 셀렉터 반영)"""
    print(f"[사람인] '{keyword}' 수집 시작...")
    url = f"https://www.saramin.co.kr/zf_user/search?searchword={keyword}"
    headers = {"User-Agent": random.choice(USER_AGENTS)}
    
    try:
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        job_list = soup.select('.item_recruit')
        results = []
        
        for job in job_list:
            try:
                company = job.select_one('.area_corp .corp_name a').text.strip()
                title_el = job.select_one('.area_job .job_tit a')
                title = title_el.text.strip()
                link = "https://www.saramin.co.kr" + title_el['href']
                
                conditions = job.select('.area_job .job_condition span')
                loc = conditions[0].text.strip() if len(conditions) > 0 else "전국"
                exp = conditions[1].text.strip() if len(conditions) > 1 else "경력무관"
                
                deadline = job.select_one('.area_job .job_date .date').text.strip() if job.select_one('.area_job .job_date .date') else "상시채용"
                
                results.append({
                    "platform": "Saramin",
                    "company": company,
                    "title": title,
                    "matchedCategories": get_category(title),
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

def save_to_json(new_data):
    """수집된 데이터를 jobs.json 파일에 누적(Merge)하여 저장 (중복 제거 및 회원사 체크)"""
    file_path = "jobs.json"
    today_str = time.strftime("%Y-%m-%d")
    
    # 회원사 명단 로드
    try:
        with open('members.json', 'r', encoding='utf-8') as f:
            members = json.load(f)
    except:
        members = []

    # 기존 데이터 로드
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
    except:
        existing_data = []

    existing_urls = {item['url'] for item in existing_data}
    
    added_count = 0
    for item in new_data:
        if item['url'] not in existing_urls:
            # 회원사 여부 체크 (회사명 포함 여부로 판별)
            item['isMember'] = any(m in item['company'] or item['company'] in m for m in members)
            item['posted_date'] = today_str
            # ID 부여 (역순 정렬을 위해)
            item['id'] = len(existing_data) + 1
            existing_data.append(item)
            existing_urls.add(item['url'])
            added_count += 1

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=4)
        print(f"\n[완료] {added_count}건의 새로운 공고가 추가되었습니다. (총 {len(existing_data)}건)")
    except Exception as e:
        print(f"저장 에러: {e}")

if __name__ == "__main__":
    all_results = []
    
    for kw in SEARCH_KEYWORDS:
        all_results += crawl_jobkorea(kw)
        time.sleep(random.uniform(1, 2))
        all_results += crawl_saramin(kw)
        time.sleep(random.uniform(1, 2))
    
    if all_results:
        save_to_json(all_results)
    else:
        print("수집된 데이터가 없습니다.")
