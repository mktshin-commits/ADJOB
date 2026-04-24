let ALL_JOBS = []; // Data from jobs.json will be stored here
let KODA_MEMBERS = []; // Data from members.json will be stored here

// 1. 직무 분류 엔진 설정 (컬러 매핑 포함)
const JOB_CATEGORIES = {
    "기획/전략": {
        keywords: ["AE", "AP", "매체 플래너", "캠페인 플래너", "기획", "전략"],
        color: "#E0F2FE", 
        textColor: "#0369A1"
    },
    "크리에이티브": {
        keywords: ["카피", "아트", "디자인", "영상 PD", "카피라이터", "아트디렉터", "디자이너"],
        color: "#FCE7F3", 
        textColor: "#BE185D" // 핑크 계열
    },
    "퍼포먼스": {
        keywords: ["퍼포먼스 마케팅", "미디어 바잉", "데이터 분석", "퍼포먼스", "매체사", "ROAS"],
        color: "#F0FDF4", 
        textColor: "#15803D"
    },
    "소셜/콘텐츠": {
        keywords: ["SNS 에디터", "인플루언서", "바이럴", "콘텐츠", "SNS", "유튜브"],
        color: "#FFF7ED", 
        textColor: "#C2410C"
    },
    "테크/AI": {
        keywords: ["마케팅 엔지니어", "AI 프롬프트", "데이터 엔지니어", "AI", "GA4", "개발"],
        color: "#EFF6FF", 
        textColor: "#1D4ED8" // 블루 계열
    }
};

function matchCategories(title, techStacks = []) {
    const matched = new Set();
    const combinedText = (title + " " + techStacks.join(" ")).toLowerCase();

    for (const [category, data] of Object.entries(JOB_CATEGORIES)) {
        for (const kw of data.keywords) {
            if (combinedText.includes(kw.toLowerCase())) {
                matched.add(category);
                break;
            }
        }
    }
    
    return Array.from(matched);
}

// View Toggle Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const feedView = document.getElementById('feedView');
const tableView = document.getElementById('tableView');

// Elements
const jobListEl = document.getElementById('jobList');
const countEl = document.getElementById('count');
const resultSummaryEl = document.querySelector('.result-count'); // 요약 텍스트 영역
const detailModal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');
const memberTableBody = document.getElementById('memberTableBody');

// Filters
const searchInput = document.getElementById('searchInput');
const expFilters = document.querySelectorAll('.filter-exp');
const locationFilter = document.getElementById('locationFilter');
const kodaaFilter = document.getElementById('kodaaFilter');
const sortFilter = document.getElementById('sortFilter');
const dateFilter = document.getElementById('dateFilter');
const showExpiredToggle = document.getElementById('showExpiredToggle');
const techChips = document.querySelectorAll('.chip');

let activeTechFilter = null;

// Tab Switching Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 모든 뷰 숨기기
        document.querySelectorAll('.view-section').forEach(view => view.classList.add('hidden'));

        const targetId = btn.dataset.target;
        document.getElementById(targetId).classList.remove('hidden');

        if (targetId === 'tableView') {
            renderTable();
        } else if (targetId === 'statsView') {
            renderStatsView();
        }
    });
});

// Logo Click Logic
const logoEl = document.querySelector('.logo');
logoEl.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-target="feedView"]').classList.add('active');
    tableView.classList.add('hidden');
    feedView.classList.remove('hidden');
    
    searchInput.value = '';
    kodaaFilter.checked = false;
    locationFilter.value = '';
    expFilters.forEach(cb => cb.checked = false);
    techChips.forEach(c => c.classList.remove('active'));
    activeTechFilter = null;
    
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function loadData() {
    try {
        try {
            const memberResponse = await fetch('members.json');
            if (memberResponse.ok) {
                KODA_MEMBERS = await memberResponse.json();
            }
        } catch (e) {
            console.warn('members.json 로딩 실패');
        }

        const response = await fetch('jobs.json');
        if (!response.ok) {
            throw new Error('jobs.json 데이터를 불러오는데 실패했습니다.');
        }
        
        const rawJobs = await response.json();
        
        ALL_JOBS = rawJobs.map(job => {
            // 게시일이 없으면 오늘 날짜를 기본값으로 설정 (전문가 조언 반영)
            const todayStr = new Date().toISOString().split('T')[0];
            return {
                ...job,
                posted_date: job.posted_date || todayStr,
                isMember: KODA_MEMBERS.some(member => 
                    job.company.includes(member) || member.includes(job.company)
                ),
                matchedCategories: matchCategories(job.title, job.techStack)
            };
        });
        
        applyFilters(); 
        renderTable(); 
        renderStatsView(); // 통계 초기 렌더링
    } catch (error) {
        console.error('데이터 로딩 에러:', error);
        jobListEl.innerHTML = `<div style="text-align:center; padding: 3rem; color: #718096;">데이터를 불러올 수 없습니다.</div>`;
    }
}

function renderJobs(jobs) {
    jobListEl.innerHTML = '';
    
    // 결과 요약 표시
    const categoryText = activeTechFilter ? `[${activeTechFilter}] 분야 ` : '';
    resultSummaryEl.innerHTML = `현재 ${categoryText}공고 총 <span id="count">${jobs.length}</span>건`;

    if(jobs.length === 0) {
        jobListEl.innerHTML = '<div style="text-align:center; padding: 3rem; color: #718096;">조건에 맞는 공고가 없습니다.</div>';
        return;
    }

    jobs.forEach(job => {
        const card = document.createElement('div');
        card.className = 'job-card';
        
        const daysLeft = getDaysLeft(job.deadline);
        const isExpired = daysLeft === '마감';
        
        if (isExpired) card.classList.add('expired');

        let kodaBadge = job.isMember ? `<span class="koda-badge">[KODA 회원사]</span>` : '';
        
        // 마감 임박 체크 (3일 이내)
        let urgentBadge = (!isExpired && daysLeft !== '∞' && daysLeft <= 3) 
            ? `<span class="urgent-badge">마감임박</span>` 
            : '';
        
        if (isExpired) {
            urgentBadge = `<span class="badge expired">채용 마감</span>`;
        }

        // 플랫폼 아이콘 (간이 처리)
        let platformIcon = job.platform === 'Saramin' 
            ? 'https://www.saramin.co.kr/favicon.ico' 
            : 'https://www.jobkorea.co.kr/favicon.ico';

        // 하단 태그 구성 (#직무, #경력, #지역)
        const jobCategoryTag = job.matchedCategories.length > 0 ? `#${job.matchedCategories[0]}` : '';
        const expTag = job.experience.length > 0 ? `#${job.experience[0]}` : '';
        const locTag = `#${job.location.split(' ')[1] || job.location}`;

        card.innerHTML = `
            <img src="${platformIcon}" class="platform-icon" alt="${job.platform}">
            <div class="job-header">
                <div class="company-wrapper">
                    <span class="company-name">${job.company}</span>
                    ${kodaBadge}
                    ${urgentBadge}
                </div>
                <span class="badge ${isExpired ? 'expired' : ''}">${job.deadline === '상시채용' ? '상시채용' : isExpired ? '마감됨' : 'D-' + daysLeft}</span>
            </div>
            <h2 class="job-title">${job.title}</h2>
            <div class="job-tags">
                <span>${jobCategoryTag}</span>
                <span>${expTag}</span>
                <span>${locTag}</span>
            </div>
        `;
        
        card.addEventListener('click', () => showDetail(job));
        jobListEl.appendChild(card);
    });
}

function renderStatistics(jobs) {
    const totalJobs = jobs.length;
    
    // 가장 많이 채용한 직무 찾기
    const categoryCounts = {};
    jobs.forEach(job => {
        job.matchedCategories.forEach(cat => {
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
    });
    const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] || "-";

    // 가장 많이 채용한 기업 TOP 3
    const companyCounts = {};
    jobs.forEach(job => {
        companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
    });
    const topCompanies = Object.keys(companyCounts)
        .sort((a, b) => companyCounts[b] - companyCounts[a])
        .slice(0, 3)
        .join(", ") || "-";

    document.getElementById('statTotalJobs').textContent = `${totalJobs}건`;
    document.getElementById('statTopCategory').textContent = topCategory;
    document.getElementById('statTopCompanies').textContent = topCompanies;
}

function getDaysLeft(deadline) {
    if (deadline === '상시채용') return '∞';
    const today = new Date();
    const end = new Date(deadline);
    const diff = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : '마감';
}

function renderTable() {
    if (!memberTableBody) return;
    memberTableBody.innerHTML = '';
    
    // 유니크한 회원사 명단 (대소문자 및 공백 제거 고려)
    const uniqueMembers = [...new Set(KODA_MEMBERS)].map(m => m.trim());
    
    // 회원사별 정보 가공
    const memberData = uniqueMembers.map(company => {
        // 해당 회원사의 공고 찾기 (회사명이 포함되거나 포함된 경우)
        const companyJobs = ALL_JOBS.filter(job => 
            job.company.includes(company) || company.includes(job.company)
        );
        
        // 마감되지 않은 공고만 필터링
        const activeJobs = companyJobs.filter(job => {
            const days = getDaysLeft(job.deadline);
            return days !== '마감';
        });
        
        let minDays = 9999; // 기본값 (아주 먼 미래)
        activeJobs.forEach(job => {
            const days = getDaysLeft(job.deadline);
            const daysNum = days === '∞' ? 999 : parseInt(days);
            if (!isNaN(daysNum) && daysNum < minDays) minDays = daysNum;
        });

        return {
            name: company,
            jobCount: activeJobs.length,
            minDays: minDays
        };
    });

    // 정렬 로직 (구인 중 우선 -> 마감임박순 -> 가나다순)
    memberData.sort((a, b) => {
        // 1. 구인 중인 기업이 상단으로 (jobCount > 0 이면 위로)
        if (a.jobCount > 0 && b.jobCount === 0) return -1;
        if (a.jobCount === 0 && b.jobCount > 0) return 1;

        // 2. 둘 다 구인 중인 경우 -> 마감임박순 (minDays 오름차순)
        if (a.jobCount > 0 && b.jobCount > 0) {
            if (a.minDays !== b.minDays) {
                return a.minDays - b.minDays;
            }
        }

        // 3. 그 외 (둘 다 구인 없거나 마감일 같음) -> 가나다순
        return a.name.localeCompare(b.name, 'ko');
    });

    memberData.forEach((member, index) => {
        const tr = document.createElement('tr');
        const isHiring = member.jobCount > 0;
        
        let statusHtml = isHiring 
            ? `<span class="status-hiring">구인 중</span>` 
            : `<span class="status-none">공고 없음</span>`;
        
        let actionHtml = isHiring 
            ? `<button class="action-btn" onclick="filterByCompany('${member.name}')">공고 보기</button>` 
            : `<span style="color:#CBD5E1">-</span>`;
        
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td style="font-weight: 700;">${member.name}</td>
            <td>${member.jobCount}건</td>
            <td>${statusHtml}</td>
            <td>${actionHtml}</td>
        `;
        memberTableBody.appendChild(tr);
    });
}

let monthlyTrendChart = null;
let jobDistributionChart = null;

function renderStatsView() {
    const statsContainer = document.getElementById('statsView');
    if (!statsContainer) return;

    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    // 1. 핵심 지표 계산
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    
    const jobsThisMonth = ALL_JOBS.filter(j => {
        const d = new Date(j.posted_date);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(today.getMonth() - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();
    
    const jobsLastMonth = ALL_JOBS.filter(j => {
        const d = new Date(j.posted_date);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    
    // 증감률 계산
    const trendPercent = jobsLastMonth.length === 0 ? 100 : Math.round(((jobsThisMonth.length - jobsLastMonth.length) / jobsLastMonth.length) * 100);
    const trendText = trendPercent >= 0 ? `+${trendPercent}%` : `${trendPercent}%`;
    const trendColor = trendPercent >= 0 ? '#10B981' : '#EF4444';

    document.getElementById('thisMonthJobs').textContent = `${jobsThisMonth.length}건`;
    const monthTrendEl = document.getElementById('monthTrend');
    monthTrendEl.textContent = `전월 대비 ${trendText}`;
    monthTrendEl.style.color = trendColor;

    const activeCompanies = new Set(ALL_JOBS.filter(j => getDaysLeft(j.deadline) !== '마감').map(j => j.company));
    document.getElementById('activeCompanyCount').textContent = `${activeCompanies.size}개사`;

    // 가장 수요 높은 직무
    const catCounts = {};
    ALL_JOBS.filter(j => {
        const d = new Date(j.posted_date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return d >= thirtyDaysAgo;
    }).forEach(j => {
        j.matchedCategories.forEach(c => catCounts[c] = (catCounts[c] || 0) + 1);
    });
    const topJob = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a])[0] || "-";
    document.getElementById('mostDemandedJob').textContent = topJob;

    // KODA 회원사 비중
    const kodaJobs = ALL_JOBS.filter(j => j.isMember);
    const kodaShare = Math.round((kodaJobs.length / ALL_JOBS.length) * 100) || 0;
    document.getElementById('kodaShareText').textContent = `KODA 회원사가 국내 광고 채용 시장의 약 ${kodaShare}%를 선도하고 있습니다.`;

    // 2. 월별 추이 차트 데이터 (최근 12개월)
    const monthsLabels = [];
    const jobsData = [];
    const compsData = [];
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(today.getMonth() - i);
        const m = d.getMonth();
        const y = d.getFullYear();
        monthsLabels.push(`${m + 1}월`);
        
        const monthlyJobs = ALL_JOBS.filter(j => {
            const jd = new Date(j.posted_date);
            return jd.getMonth() === m && jd.getFullYear() === y;
        });
        jobsData.push(monthlyJobs.length);
        compsData.push(new Set(monthlyJobs.map(j => j.company)).size);
    }

    if (monthlyTrendChart) monthlyTrendChart.destroy();
    const ctxTrend = document.getElementById('monthlyTrendChart').getContext('2d');
    monthlyTrendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: monthsLabels,
            datasets: [
                {
                    label: '채용 공고 수',
                    data: jobsData,
                    borderColor: '#2563EB',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '채용 기업 수',
                    data: compsData,
                    borderColor: '#10B981',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 3. 직무별 비중 차트 (Pie)
    const pieData = Object.keys(JOB_CATEGORIES).map(cat => {
        return ALL_JOBS.filter(j => j.matchedCategories.includes(cat)).length;
    });

    if (jobDistributionChart) jobDistributionChart.destroy();
    const ctxPie = document.getElementById('jobDistributionChart').getContext('2d');
    jobDistributionChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: Object.keys(JOB_CATEGORIES),
            datasets: [{
                data: pieData,
                backgroundColor: ['#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#6366F1']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // 4. 기업별 순위 테이블 (최근 6개월)
    const rankingBody = document.getElementById('companyRankingBody');
    rankingBody.innerHTML = '';
    
    const companyStats = {};
    ALL_JOBS.filter(j => new Date(j.posted_date) >= sixMonthsAgo).forEach(j => {
        if (!companyStats[j.company]) {
            companyStats[j.company] = { count: 0, categories: {}, isMember: j.isMember };
        }
        // 채용 인원 추정 로직 (팁 반영)
        // 0명이면 1.5명, 그 외는 1명으로 계산 (간이 합산)
        const hiringEstimate = j.title.includes('0명') ? 1.5 : 1.0;
        companyStats[j.company].count += hiringEstimate;
        
        j.matchedCategories.forEach(c => {
            companyStats[j.company].categories[c] = (companyStats[j.company].categories[c] || 0) + 1;
        });
    });

    const sortedCompanies = Object.keys(companyStats).sort((a,b) => companyStats[b].count - companyStats[a].count).slice(0, 10);

    sortedCompanies.forEach((name, i) => {
        const data = companyStats[name];
        const topCat = Object.keys(data.categories).sort((a,b) => data.categories[b] - data.categories[a])[0] || "-";
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="rank-badge">${i + 1}</span></td>
            <td style="font-weight:700;">${name}</td>
            <td>${Math.floor(data.count)}건+</td>
            <td>${topCat}</td>
            <td>${data.isMember ? '✨ KODA' : '-'}</td>
        `;
        rankingBody.appendChild(tr);
    });
}

window.filterByCompany = function(companyName) {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-target="feedView"]').classList.add('active');
    tableView.classList.add('hidden');
    feedView.classList.remove('hidden');
    searchInput.value = companyName;
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showDetail(job) {
    let kodaBadge = job.isMember ? `<span class="highlight-tag tag-kodaa" style="margin-left:10px;">✨ 인증 회원사</span>` : '';
    const catTags = job.matchedCategories.map(cat => {
        const style = JOB_CATEGORIES[cat] || { color: '#F1F5F9', textColor: '#475569' };
        return `<span class="highlight-tag" style="background-color: ${style.color}; color: ${style.textColor}; margin-right: 5px;">${cat}</span>`;
    }).join('');
    const techTags = job.techStack.map(tech => `<span>${tech}</span>`).join('');

    modalBody.innerHTML = `
        <div class="modal-company">${job.company} ${kodaBadge}</div>
        <h2 class="modal-title">${job.title}</h2>
        <div style="margin-bottom: 1rem; color: #718096; font-size: 0.95rem; font-weight: 600;">
            <span>📍 ${job.location}</span> | <span>💼 ${job.experience.join(', ')}</span> | <span>💰 ${job.salary}</span>
        </div>
        <div class="job-tags" style="margin-bottom: 2rem;">
            ${catTags}
            ${techTags}
        </div>
        <div class="modal-details">
            <h3>지원 자격 및 상세 내용</h3>
            <p style="margin-top: 1rem; line-height: 1.8;">
                본 공고는 <strong>${job.company}</strong>의 공식 채용 정보입니다.<br>
                직무 분야: ${job.matchedCategories.join(', ') || '미분류'}<br>
                마감일: ${job.deadline}
            </p>
        </div>
        <a href="${job.url}" class="apply-btn" target="_blank">
            ${job.platform === 'Saramin' ? '사람인' : '잡코리아'}에서 원본 공고 보기 / 지원하기
        </a>
    `;
    detailModal.style.display = 'flex';
}

closeModal.addEventListener('click', () => {
    detailModal.style.display = 'none';
});

detailModal.addEventListener('click', (e) => {
    if(e.target === detailModal) detailModal.style.display = 'none';
});

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const checkedExps = Array.from(expFilters).filter(cb => cb.checked).map(cb => cb.value);
    const selectedLocation = locationFilter.value;
    const isKodaOnly = kodaaFilter.checked; 
    const selectedDateMonth = dateFilter.value;
    const isShowExpired = showExpiredToggle.checked;

    const today = new Date();

    let filtered = ALL_JOBS.filter(job => {
        // 검색어: 제목, 회사명, 그리고 매칭된 직무 카테고리 포함 확인
        const matchesSearch = job.title.toLowerCase().includes(searchTerm) || 
                              job.company.toLowerCase().includes(searchTerm) ||
                              job.matchedCategories.some(cat => cat.toLowerCase().includes(searchTerm));
                              
        let matchesExp = checkedExps.length === 0 || job.experience.some(exp => checkedExps.includes(exp));
        let matchesLoc = !selectedLocation || job.location.includes(selectedLocation);
        let matchesTech = !activeTechFilter || (job.matchedCategories && job.matchedCategories.includes(activeTechFilter));
        let matchesKoda = !isKodaOnly || job.isMember === true;

        // 게시 기간 필터링 로직
        let matchesDate = true;
        if (selectedDateMonth !== 'all') {
            const months = parseInt(selectedDateMonth);
            const postDate = new Date(job.posted_date);
            const cutoffDate = new Date();
            cutoffDate.setMonth(today.getMonth() - months);
            matchesDate = postDate >= cutoffDate;
        }

        return matchesSearch && matchesExp && matchesLoc && matchesTech && matchesKoda && matchesDate;
    });

    // 통계 계산은 필터링된 모든 공고(진행+마감)를 대상으로 함
    renderStatistics(filtered);

    // 리스트 표시는 토글 상태에 따라 마감 공고 제외 여부 결정
    if (!isShowExpired) {
        filtered = filtered.filter(job => getDaysLeft(job.deadline) !== '마감');
    }

    // 정렬: 인증 회원사 우선 노출
    filtered.sort((a, b) => {
        if (a.isMember && !b.isMember) return -1;
        if (!a.isMember && b.isMember) return 1;
        const sortMode = sortFilter.value;
        if (sortMode === 'deadline') {
            if (a.deadline === '상시채용') return 1;
            if (b.deadline === '상시채용') return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        }
        return b.id - a.id; 
    });

    renderJobs(filtered);
}

searchInput.addEventListener('input', applyFilters);
expFilters.forEach(cb => cb.addEventListener('change', applyFilters));
locationFilter.addEventListener('change', applyFilters);
kodaaFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);
dateFilter.addEventListener('change', applyFilters);
showExpiredToggle.addEventListener('change', applyFilters);

techChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const value = chip.dataset.value;
        
        techChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        activeTechFilter = value === "" ? null : value;
        
        applyFilters();
    });
});

loadData();
