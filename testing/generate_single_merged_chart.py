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
plt.rcParams['font.size'] = 11
plt.rcParams['axes.edgecolor'] = '#333333'
plt.rcParams['axes.linewidth'] = 0.8

plt.figure(figsize=(7.5, 5))

# Define colors for risk levels
risk_colors = {'LOW': '#00F5A0', 'MEDIUM': '#FF9F43', 'HIGH': '#FF4757'}

# Plot each emotion category with a different marker style
# FOCUSED -> circle (o), SLEEPY -> triangle_up (^), BORED -> square (s)
emotion_markers = {'FOCUSED': ('o', 'Focused'), 'SLEEPY': ('^', 'Sleepy'), 'BORED': ('s', 'Bored')}

# Group by emotion and plot
for emotion, (marker, label) in emotion_markers.items():
    sub_df = df[df['dominant_emotion'] == emotion]
    if sub_df.empty:
        continue
    
    colors = sub_df['risk_level'].map(risk_colors)
    
    plt.scatter(
        sub_df['avg_focus_pct'], 
        sub_df['topics_completed_count'],
        c=colors, 
        marker=marker,
        edgecolor='#333333', 
        s=90, 
        alpha=0.9, 
        label=f'Emotion: {label}'
    )

# Draw a single global trendline showing overall focus-completion correlation
x = df['avg_focus_pct']
y = df['topics_completed_count']
m, b = np.polyfit(x, y, 1)
plt.plot(x, m*x + b, color='#6C63FF', linestyle='--', linewidth=1.5, label=f'Trendline (slope: {m:.2f})')

# Grid and Labels
plt.title('Multi-Dimensional Learner Performance Analysis', fontsize=13, fontweight='bold', pad=12)
plt.xlabel('Average Focus Score (%)', labelpad=8)
plt.ylabel('Completed Topics Count', labelpad=8)
plt.grid(linestyle='--', alpha=0.4)

# Create custom multi-group legends
from matplotlib.patches import Patch
from matplotlib.lines import Line2D

# Legend part 1: Risk Levels (Colors)
legend_risk = [
    Patch(facecolor='#00F5A0', edgecolor='#333333', label='Low Risk'),
    Patch(facecolor='#FF9F43', edgecolor='#333333', label='Medium Risk'),
    Patch(facecolor='#FF4757', edgecolor='#333333', label='High Risk')
]

# Legend part 2: Dominant Emotions (Markers)
legend_emotion = [
    Line2D([0], [0], marker='o', color='w', markerfacecolor='gray', markeredgecolor='black', markersize=8, label='Focused'),
    Line2D([0], [0], marker='^', color='w', markerfacecolor='gray', markeredgecolor='black', markersize=8, label='Sleepy'),
    Line2D([0], [0], marker='s', color='w', markerfacecolor='gray', markeredgecolor='black', markersize=8, label='Bored'),
    Line2D([0], [0], color='#6C63FF', linestyle='--', linewidth=1.5, label='Trendline')
]

# Combine both legends
first_legend = plt.legend(handles=legend_risk, loc='upper left', title='Risk Profile (Color)')
plt.gca().add_artist(first_legend)
plt.legend(handles=legend_emotion, loc='lower right', title='Engagement Indicators')

plt.tight_layout()
os.makedirs("plots", exist_ok=True)
plt.savefig("plots/merged_student_analysis.png", dpi=300)
plt.close()

print("Merged single plot successfully generated in plots/merged_student_analysis.png.")
