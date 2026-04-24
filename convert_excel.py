import json
import sys

try:
    import pandas as pd
    df = pd.read_excel(r'c:\T\ad-job-board\회원사 리스트.xlsx')
    
    # "회사명" 칼럼 추출
    if '회사명' in df.columns:
        members = df['회사명'].dropna().astype(str).str.strip().tolist()
        
        with open(r'c:\T\ad-job-board\members.json', 'w', encoding='utf-8') as f:
            json.dump(members, f, ensure_ascii=False, indent=2)
            
        print(f"Success: Saved {len(members)} members to members.json")
    else:
        print("Error: '회사명' 칼럼이 없습니다. 존재하는 칼럼:", list(df.columns))

except ImportError:
    print("Error: pandas 또는 openpyxl 라이브러리가 설치되어 있지 않습니다.")
    print("실행 방법: pip install pandas openpyxl")
except Exception as e:
    print(f"Error: {e}")
