# EXPECT: COMPLETED
import threading
t = threading.Thread(target=lambda: print("thread ok"))
t.start()
t.join()
