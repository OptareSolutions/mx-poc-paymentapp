package com.att.paymentbox;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PaymentBoxApplication implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PaymentBoxApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(PaymentBoxApplication.class, args);
    }

    @Override
    public void run(String... args) {
        log.info("PoC TRA-34 smoke: microservice-a desde E (+ UI + RPA) 2026-05-14");
    }
}
