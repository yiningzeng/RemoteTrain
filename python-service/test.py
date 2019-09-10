import requests
import os

if __name__ == '__main__':
    projectId = os.popen('cat ../aa/project_id22.log').read().replace('\n', '')
    if projectId == "":
        print("aasdsd")
    json_data = [{"x": 13.00, "y": 13.33, "win_id": "asdasdsadsadsaddsa-123", "title": "asdasdsadsadsaddsa-123"}]
    r11 = requests.post("http://192.168.31.75:18888/draw_chart", json=json_data)
    print(r11.json())