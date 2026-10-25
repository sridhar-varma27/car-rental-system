
package com.carrental.repository;

import com.carrental.entity.Booking;
import com.carrental.entity.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByUserId(Long userId);

    List<Booking> findByCarId(Long carId);

    List<Booking> findByStatus(BookingStatus status);

    @Query("""
            SELECT b
            FROM Booking b
            WHERE b.car.id = :carId
            AND b.status IN :statuses
            AND b.startDate < :endDate
            AND b.endDate > :startDate
            """)
    List<Booking> findOverlappingBookings(
            @Param("carId") Long carId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<BookingStatus> statuses
    );

    @Query("""
            SELECT COUNT(b) > 0
            FROM Booking b
            WHERE b.car.id = :carId
            AND b.status IN :statuses
            AND b.startDate < :endDate
            AND b.endDate > :startDate
            """)
    boolean existsOverlappingBooking(
            @Param("carId") Long carId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            @Param("statuses") List<BookingStatus> statuses
    );
}
