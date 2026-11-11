"""Download the public NHANES files used in the analysis (US CDC, National Center for Health Statistics).

Cycles 2011-2012 (suffix G) and 2013-2014 (suffix H), the two cycles with cognitive testing of adults aged 60 and over:
  DEMO  demographics, education, survey weights and design variables
  CFQ   cognitive functioning (Digit Symbol Substitution Test, CERAD word learning, animal fluency)
  MCQ   medical conditions questionnaire (self-reported worsening confusion or memory loss)
NHANES public-use data are in the public domain.

Usage:  python download_data.py <target_dir>
"""
import os
import sys
import urllib.request

BASE = 'https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public'
FILES = [('2011', 'DEMO_G'), ('2011', 'CFQ_G'), ('2011', 'MCQ_G'), ('2013', 'DEMO_H'), ('2013', 'CFQ_H'), ('2013', 'MCQ_H')]


def main():
    target = os.path.abspath(sys.argv[1])
    os.makedirs(target, exist_ok=True)
    for year, name in FILES:
        dest = os.path.join(target, name + '.xpt')
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            print('have', name)
            continue
        url = f'{BASE}/{year}/DataFiles/{name}.xpt'
        with urllib.request.urlopen(url, timeout=120) as r, open(dest + '.part', 'wb') as f:
            f.write(r.read())
        os.replace(dest + '.part', dest)
        print('ok  ', name, os.path.getsize(dest), 'bytes')


if __name__ == '__main__':
    main()
