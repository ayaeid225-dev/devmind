package main

import (
	"fmt"
	"net/http"
)

type Reader interface {
	Read(p []byte) (n int, err error)
}

type User struct {
	ID   string
	Name string
}

func (u *User) GetName() string {
	return u.Name
}

func (u *User) SetName(name string) {
	u.Name = name
}

func CalculateStats(values []int) int {
	sum := 0
	for _, v := range values {
		sum += v
	}
	return sum
}

func main() {
	fmt.Println("Go Backend Started")
}
