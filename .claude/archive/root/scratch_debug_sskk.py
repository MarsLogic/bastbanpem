with open("sskk_output.txt", "r", encoding="utf-8") as f:
    text = f.read()
idx = text.find('6. Pengepakan')
if idx != -1:
    print(text[idx:idx+1500])
