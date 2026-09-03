import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

# Read the CSV
csv_path = "student_testing_results.csv"
if not os.path.exists(csv_path):
    print("CSV file not found!")
    exit(1)

df = pd.read_csv(csv_path)

# Set global plotting style for academic presentation
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.size'] = 10
plt.rcParams['axes.edgecolor'] = '#333333'
plt.rcParams['axes.linewidth'] = 0.8

# Create a 1x3 subplot grid
fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(15, 4.5))

# ─── Panel A: Risk Level Distribution ───────────────────────────────────────
risk_counts = df['risk_level'].value_counts().reindex(['LOW', 'MEDIUM', 'HIGH'])
colors_risk = ['#00F5A0', '#FF9F43', '#FF4757']
bars = ax1.bar(risk_counts.index, risk_counts.values, color=colors_risk, edgecolor='#333333', width=0.55)

# Add values on top of bars
for bar in bars:
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2.0, height + 0.3, f'{int(height)}', ha='center', va='bottom', fontweight='bold')

ax1.set_title('(a) Learner Risk Profile Distribution', fontsize=11, fontweight='bold', pad=10)
ax1.set_xlabel('Risk Level', labelpad=6)
ax1.set_ylabel('Student Count', labelpad=6)
ax1.set_ylim(0, max(risk_counts.values) + 3)
ax1.grid(axis='y', linestyle='--', alpha=0.5)

# ─── Panel B: Emotion Breakdown by Risk Level ──────────────────────────────
avg_emotions = df.groupby('risk_level')[['focused_pct', 'bored_pct', 'sleepy_pct']].mean().reindex(['LOW', 'MEDIUM', 'HIGH'])
avg_emotions.columns = ['Focused %', 'Bored %', 'Sleepy %']

# Stacked bar plot
avg_emotions.plot(kind='bar', stacked=True, color=['#00F5A0', '#A29BFE', '#FF9F43'], edgecolor='#333333', width=0.55, ax=ax2)

ax2.set_title('(b) Emotion Composition by Risk Level', fontsize=11, fontweight='bold', pad=10)
ax2.set_xlabel('Risk Level', labelpad=6)
ax2.set_ylabel('Percentage Composition (%)', labelpad=6)
ax2.set_xticklabels(['LOW', 'MEDIUM', 'HIGH'], rotation=0)
ax2.legend(loc='lower left', framealpha=0.9, fontsize=9)
ax2.grid(axis='y', linestyle='--', alpha=0.5)

# ─── Panel C: Focus vs Topics Completed (Scatter with Trend) ────────────────
x = df['avg_focus_pct']
y = df['topics_completed_count']
colors_scatter = df['risk_level'].map({'LOW': '#00F5A0', 'MEDIUM': '#FF9F43', 'HIGH': '#FF4757'})

# Scatter plot
ax3.scatter(x, y, c=colors_scatter, edgecolor='#333333', alpha=0.85, s=50)

# Draw trendline
m, b = np.polyfit(x, y, 1)
ax3.plot(x, m*x + b, color='#6C63FF', linestyle='-', linewidth=1.5)

ax3.set_title('(c) Average Focus vs. Completed Topics', fontsize=11, fontweight='bold', pad=10)
ax3.set_xlabel('Average Focus Score (%)', labelpad=6)
ax3.set_ylabel('Completed Topics Count', labelpad=6)
ax3.grid(linestyle='--', alpha=0.5)

# Custom legend for scatter
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor='#00F5A0', edgecolor='#333333', label='Low Risk'),
    Patch(facecolor='#FF9F43', edgecolor='#333333', label='Med Risk'),
    Patch(facecolor='#FF4757', edgecolor='#333333', label='High Risk'),
    plt.Line2D([0], [0], color='#6C63FF', linewidth=1.5, label=f'Trend (slope: {m:.2f})')
]
ax3.legend(handles=legend_elements, loc='upper left', fontsize=9)

# Adjust layout and save
plt.suptitle('Multi-Dimensional Analysis of SmartFocus Validation Metrics', fontsize=13, fontweight='bold', y=0.98)
plt.tight_layout()
os.makedirs("plots", exist_ok=True)
plt.savefig("plots/combined_student_analysis.png", dpi=300)
plt.close()

print("Combined multi-panel chart successfully generated in plots/ combined_student_analysis.png.")
