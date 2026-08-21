import pandas as pd

files = [
    "DEMO_J.xpt",
    "BMX_J.xpt",
    "DXX_J.xpt",
    "PAQ_J.xpt",
    "SLQ_J.xpt",
    "MCQ_J.xpt",
    "WHQ_J.xpt",
    "DR1TOT_J.xpt"
]

for f in files:
    df = pd.read_sas(f)
    print("\n", f)
    print(df.columns[:20])