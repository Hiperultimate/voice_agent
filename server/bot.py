async def run_bot(websocket_client):
    while True:
        data = await websocket_client.receive_text()
        print(f"Message text was: {data}")
        await websocket_client.send_text(f"Message text was: {data}")