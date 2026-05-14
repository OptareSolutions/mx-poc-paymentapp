package com.att.paymentbox.customerprofile;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CustomerProfileApplication implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CustomerProfileApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(CustomerProfileApplication.class, args);
    }

    @Override
    public void run(String... args) {
        log.info("PoC TRA-34 smoke: microservice-b desde E (+ UI + RPA) 2026-05-14");
    }
}
