package main

import (
	"fmt"
	"github.com/gorilla/websocket"
	"math/rand"
	"net/http"
	"time"
)

type Msg struct {
	Type string
	Data string
	Key  string
}

type Connection struct {
	Offer   string
	Client1 *websocket.Conn
	Client2 *websocket.Conn
}

const storageLimit = 1000

var data map[string]Connection

func main() {
	rand.Seed(time.Now().UTC().UnixNano())

	data = make(map[string]Connection)

	http.HandleFunc("/", handler)

	panic(http.ListenAndServe(":3004", nil))
}

func handler(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Upgrade(w, r, w.Header(), 1024, 1024)
	if err != nil {
		http.Error(w, "Could not open websocket connection", http.StatusBadRequest)
		return
	}

	go handleMessage(conn)
}

func handleMessage(conn *websocket.Conn) {
	for {
		m := Msg{}

		if err := conn.ReadJSON(&m); err != nil {
			fmt.Println("Error reading JSON", err)
			return
		}

		fmt.Printf("Message: %#v\n", m)
		switch m.Type {
		case "setOffer":
			handleOffer(conn, &m)
		case "getOffer":
			handleGetOffer(conn, &m)
		case "setAnswer":
			handleAnswer(conn, &m)
		case "ice":
			handleIce(conn, &m)
		}
	}
}

func handleOffer(conn *websocket.Conn, m *Msg) {
	if len(data) >= storageLimit {
		data = make(map[string]Connection)
	}

	key := randomKey()
	conn.WriteJSON(Msg{Type: "key", Key: key})

	data[key] = Connection{Offer: m.Data, Client1: conn}
}

func handleGetOffer(conn *websocket.Conn, m *Msg) {
	connection := data[m.Key]
	conn.WriteJSON(Msg{Type: "offer", Data: connection.Offer})
	data[m.Key] = Connection{Offer: data[m.Key].Offer, Client1: data[m.Key].Client1, Client2: conn}
}

func handleAnswer(conn *websocket.Conn, m *Msg) {
	connection := data[m.Key]
	connection.Client1.WriteJSON(Msg{Type: "answer", Data: m.Data})
}

func handleIce(conn *websocket.Conn, m *Msg) {
	client1 := data[m.Key]
	if client1.Client1 != nil {
		client1.Client1.WriteJSON(Msg{Type: "ice", Data: m.Data})
	}
	if client1.Client2 != nil {
		client1.Client2.WriteJSON(Msg{Type: "ice", Data: m.Data})
	}
}

func randomKey() string {
	letter := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

	b := make([]rune, 3)
	for i := range b {
		b[i] = letter[rand.Intn(len(letter))]
	}
	return string(b)
}
