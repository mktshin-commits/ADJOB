import requests
from bs4 import BeautifulSoup
import urllib3
urllib3.disable_warnings()

headers = {'User-Agent': 'Mozilla/5.0'}
try:
    res = requests.get('https://kodaa.or.kr/43', headers=headers, verify=False)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        soup = BeautifulSoup(res.text, 'html.parser')
        # find company names. KODAA members are usually in a table or list
        # Let's just print a snippet
        print(res.text[:500])
except Exception as e:
    print(e)
