import json
import matplotlib.pyplot as plt

# Load the log file
with open("perf_client_cli.log", "r") as f:
    lines = f.readlines()

# Parse RTT values
rtts = []
for line in lines:
    try:
        entry = json.loads(line)
        if entry.get("type") == "relay":
            rtts.append(entry["rttMs"])
    except json.JSONDecodeError:
        continue

# Plot
plt.figure(figsize=(10, 5))
plt.plot(rtts, marker='o', linestyle='-', label='RTT (ms)')
plt.title("Round-Trip Time for 100 Message Burst")
plt.xlabel("Message Index")
plt.ylabel("RTT (ms)")
plt.grid(True)
plt.ylim(0, max(rtts) + 2)
plt.legend()
plt.tight_layout()
plt.savefig("rtt_plot.png")
print("Saved plot as rtt_plot.png")