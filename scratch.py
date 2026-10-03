import ollama

MODEL = "gemma4:e4b"  # use the name from `ollama list`

resp = ollama.chat(
    model=MODEL,
    messages=[
        {"role": "system", "content": "You read WhatsApp messages and say what deadline is mentioned. Be brief."},
        {"role": "user", "content": "bro 2moro submit karna hai na assignment?"},
    ],
    options={"temperature": 1.2, "num_ctx": 4096},
)
print(resp["message"]["content"])