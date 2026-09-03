import pandas as pd
import matplotlib.pyplot as plt
import os

# Read the CSV
csv_path = "student_testing_results.csv"
if not os.path.exists(csv_path):
    print("CSV file not found!")
    exit(1)

df = pd.read_csv(csv_path)

# Set global plotting style for academic presentation
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.size'] = 11
plt.rcParams['axes.edgecolor'] = '#333333'
plt.rcParams['axes.linewidth'] = 0.8

# Ensure output directory exists
os.makedirs("plots", exist_ok=True)

# ─── Chart 1: Risk Level Distribution ───────────────────────────────────────
plt.figure(figsize=(5, 3.5))
risk_counts = df['risk_level'].value_counts().reindex(['LOW', 'MEDIUM', 'HIGH'])
colors = ['#00F5A0', '#FF9F43', '#FF4757']  # matching SmartFocus theme
bars = plt.bar(risk_counts.index, risk_counts.values, color=colors, edgecolor='#333333', width=0.5)

# Add values on top of bars
for bar in bars:
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2.0, height + 0.3, f'{int(height)}', ha='center', va='bottom', fontweight='bold')

plt.title('Learner Risk Profile Distribution', fontsize=12, fontweight='bold', pad=10)
plt.xlabel('Risk Level', labelpad=8)
plt.ylabel('Student Count', labelpad=8)
plt.ylim(0, max(risk_counts.values) + 3)
plt.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.savefig("plots/risk_distribution.png", dpi=300)
plt.close()

# ─── Chart 2: Emotion Breakdown by Risk Level ──────────────────────────────
plt.figure(figsize=(6.5, 4))
avg_emotions = df.groupby('risk_level')[['focused_pct', 'bored_pct', 'sleepy_pct']].mean().reindex(['LOW', 'MEDIUM', 'HIGH'])

# Rename columns for clarity
avg_emotions.columns = ['Focused %', 'Bored %', 'Sleepy %']

# Stacked bar plot
ax = avg_emotions.plot(kind='bar', stacked=True, color=['#00F5A0', '#A29BFE', '#FF9F43'], edgecolor='#333333', width=0.5, ax=plt.gca())

plt.title('Average Emotion Composition by Risk Level', fontsize=12, fontweight='bold', pad=10)
plt.xlabel('Risk Level', labelpad=8)
plt.ylabel('Percentage Composition (%)', labelpad=8)
plt.xticks(rotation=0)
plt.legend(bbox_to_anchor=(1.02, 1), loc='upper left', framealpha=0.8)
plt.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.savefig("plots/emotion_composition_by_risk.png", dpi=300)
plt.close()

# ─── Chart 3: Focus vs Topics Completed (Scatter with Trend) ────────────────
plt.figure(figsize=(6, 4))
x = df['avg_focus_pct']
y = df['topics_completed_count']

# Categorize colors by risk level
colors_scatter = df['risk_level'].map({'LOW': '#00F5A0', 'MEDIUM': '#FF9F43', 'HIGH': '#FF4757'})

plt.scatter(x, y, c=colors_scatter, edgecolor='#333333', alpha=0.85, s=60, label='Students')
plt.title('Average Focus Score vs. Completed Topics', fontsize=12, fontweight='bold', pad=10)
plt.xlabel('Average Focus Score (%)', labelpad=8)
plt.ylabel('Completed Topics Count', labelpad=8)
plt.grid(linestyle='--', alpha=0.5)

# Draw trendline
import numpy as np
m, b = np.polyfit(x, y, 1)
plt.plot(x, m*x + b, color='#6C63FF', linestyle='-', linewidth=1.5, label=f'Trendline (slope: {m:.2f})')

# Custom legend for risk levels
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor='#00F5A0', edgecolor='#333333', label='Low Risk'),
    Patch(facecolor='#FF9F43', edgecolor='#333333', label='Medium Risk'),
    Patch(facecolor='#FF4757', edgecolor='#333333', label='High Risk'),
    plt.Line2D([0], [0], color='#6C63FF', linewidth=1.5, label='Trendline')
]
plt.legend(handles=legend_elements, loc='upper left')

plt.tight_layout()
plt.savefig("plots/focus_vs_completed.png", dpi=300)
plt.close()

print("Charts successfully generated in plots/ directory.")
