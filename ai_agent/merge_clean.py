import pandas as pd

print("Loading NHANES datasets...")

demo = pd.read_sas("DEMO_J.xpt")
bmx = pd.read_sas("BMX_J.xpt")
dxx = pd.read_sas("DXX_J.xpt")
paq = pd.read_sas("PAQ_J.xpt")
slq = pd.read_sas("SLQ_J.xpt")
mcq = pd.read_sas("MCQ_J.xpt")
whq = pd.read_sas("WHQ_J.xpt")
diet = pd.read_sas("DR1TOT_J.xpt")

# -------------------------
# Select important columns
# -------------------------

demo = demo[["SEQN","RIAGENDR","RIDAGEYR"]]

bmx = bmx[["SEQN","BMXWT","BMXHT","BMXBMI","BMXWAIST"]]

# DXA body composition
dxx = dxx[["SEQN","DXDHEPF","DXXHEFAT","DXDHELE"]]

paq = paq[["SEQN","PAD615","PAD630","PAQ650"]]

slq = slq[["SEQN","SLD012","SLQ050"]]

mcq = mcq[["SEQN","MCQ160B","MCQ160C","MCQ160E"]]

whq = whq[["SEQN","WHD020","WHD010","WHQ030"]]

diet = diet[[
    "SEQN",
    "DR1TKCAL",
    "DR1TPROT",
    "DR1TCARB",
    "DR1TTFAT",
    "DR1TSUGR",
    "DR1TSODI"
]]

# -------------------------
# Merge datasets
# -------------------------

df = demo.merge(bmx,on="SEQN",how="inner")
df = df.merge(dxx,on="SEQN",how="left")
df = df.merge(paq,on="SEQN",how="left")
df = df.merge(slq,on="SEQN",how="left")
df = df.merge(mcq,on="SEQN",how="left")
df = df.merge(whq,on="SEQN",how="left")
df = df.merge(diet,on="SEQN",how="left")

print("Merged shape:",df.shape)

# -------------------------
# Rename columns (clean names)
# -------------------------

df = df.rename(columns={

    "RIAGENDR":"gender",
    "RIDAGEYR":"age",

    "BMXWT":"weight",
    "BMXHT":"height",
    "BMXBMI":"bmi",
    "BMXWAIST":"waist",

    "DXDHEPF":"bodyfat_pct",
    "DXXHEFAT":"bodyfat_mass",
    "DXDHELE":"lean_mass",

    "PAD615":"moderate_days",
    "PAD630":"vigorous_days",
    "PAQ650":"sitting_time",

    "SLD012":"sleep_hours",

    "MCQ160B":"diabetes",
    "MCQ160C":"heart_disease",
    "MCQ160E":"asthma",

    "WHD020":"weight_last_year",

    "DR1TKCAL":"calories",
    "DR1TPROT":"protein",
    "DR1TCARB":"carbs",
    "DR1TTFAT":"fat",
    "DR1TSUGR":"sugar",
    "DR1TSODI":"sodium"
})

# -------------------------
# Save dataset
# -------------------------

df.to_csv("nhanes_merged_dataset.csv",index=False)

print("Dataset saved successfully.")
print("Columns:",df.columns)