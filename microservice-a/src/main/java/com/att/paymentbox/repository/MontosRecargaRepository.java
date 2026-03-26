package com.att.paymentbox.repository;

import com.att.paymentbox.model.MontosRecarga;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MontosRecargaRepository extends JpaRepository<MontosRecarga, Long> {
    List<MontosRecarga> findByOperadorOrderByMontoAsc(String operador);
}
