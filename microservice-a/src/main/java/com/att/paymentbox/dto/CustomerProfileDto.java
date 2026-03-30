package com.att.paymentbox.dto;

public class CustomerProfileDto {

    private Long id;
    private String phone;
    private String fullName;
    private String status;

    public CustomerProfileDto() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
