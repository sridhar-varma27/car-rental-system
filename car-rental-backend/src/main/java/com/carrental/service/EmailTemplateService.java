
package com.carrental.service;

import org.springframework.stereotype.Service;

@Service
public class EmailTemplateService {

    private static final String PRIMARY = "#172554";
    private static final String BACKGROUND = "#f3f6fb";

    private String escape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String layout(String heading, String content) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Car Rental System</title>
                </head>
                <body style="margin:0;padding:0;background:%s;
                             font-family:Arial,Helvetica,sans-serif;color:#334155;">

                    <table width="100%%" cellpadding="0" cellspacing="0"
                           style="background:%s;padding:35px 12px;">
                        <tr>
                            <td align="center">

                                <table width="600" cellpadding="0" cellspacing="0"
                                       style="max-width:600px;width:100%%;
                                              background:#ffffff;border-radius:12px;
                                              overflow:hidden;">

                                    <tr>
                                        <td style="background:%s;padding:28px;
                                                   text-align:center;color:#ffffff;">

                                            <h1 style="margin:0;font-size:25px;">
                                                CAR RENTAL
                                            </h1>

                                            <p style="margin:8px 0 0;color:#cbd5e1;
                                                      font-size:13px;">
                                                Your journey, our priority.
                                            </p>

                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="padding:32px 28px;">

                                            <h2 style="margin:0 0 20px;color:%s;
                                                       font-size:23px;">
                                                %s
                                            </h2>

                                            %s

                                        </td>
                                    </tr>

                                    <tr>
                                        <td style="background:#f8fafc;padding:20px;
                                                   text-align:center;color:#64748b;
                                                   font-size:12px;">

                                            Thank you for choosing Car Rental System.

                                            <br><br>

                                            This is an automated email. Please do not
                                            reply directly to this message.

                                        </td>
                                    </tr>

                                </table>

                            </td>
                        </tr>
                    </table>

                </body>
                </html>
                """.formatted(
                BACKGROUND,
                BACKGROUND,
                PRIMARY,
                PRIMARY,
                escape(heading),
                content
        );
    }

    private String paragraph(String text) {
        return """
                <p style="font-size:15px;line-height:1.7;color:#475569;">
                    %s
                </p>
                """.formatted(escape(text));
    }

    private String details(String rows) {
        return """
                <table width="100%%" cellpadding="0" cellspacing="0"
                       style="margin:22px 0;border:1px solid #e2e8f0;
                              border-radius:8px;">
                    %s
                </table>
                """.formatted(rows);
    }

    private String detailRow(String label, String value) {
        return """
                <tr>
                    <td style="padding:12px;border-bottom:1px solid #e2e8f0;
                               color:#64748b;font-size:14px;">
                        %s
                    </td>

                    <td align="right"
                        style="padding:12px;border-bottom:1px solid #e2e8f0;
                               color:#172554;font-weight:bold;font-size:14px;">
                        %s
                    </td>
                </tr>
                """.formatted(escape(label), escape(value));
    }

    private String messageBox(String message, String color) {
        return """
                <div style="padding:15px;background:%s;border-radius:8px;
                            font-size:14px;line-height:1.6;color:#334155;">
                    %s
                </div>
                """.formatted(escape(color), escape(message));
    }

    public String welcomeEmail(String customerName) {

        String content = paragraph(
                "Hello " + customerName + ", welcome to Car Rental System!"
        ) + paragraph(
                "Your account has been created successfully. You can now explore "
                        + "our vehicles, compare prices and book your preferred car."
        ) + messageBox(
                "Your next journey starts here. Thank you for joining us!",
                "#eff6ff"
        );

        return layout("Welcome aboard!", content);
    }

    public String bookingConfirmationEmail(
            String customerName,
            String bookingId,
            String carName,
            String pickupDate,
            String returnDate,
            String totalAmount
    ) {

        String content = paragraph(
                "Hello " + customerName
                        + ", your booking has been confirmed successfully."
        ) + details(
                detailRow("Booking ID", bookingId)
                        + detailRow("Vehicle", carName)
                        + detailRow("Pickup Date", pickupDate)
                        + detailRow("Return Date", returnDate)
                        + detailRow("Total Amount", totalAmount)
        ) + messageBox(
                "Please keep your booking ID for future reference.",
                "#eff6ff"
        );

        return layout("Booking Confirmed!", content);
    }

    public String paymentConfirmationEmail(
            String customerName,
            String bookingId,
            String amount,
            String paymentId
    ) {

        String content = paragraph(
                "Hello " + customerName
                        + ", we have successfully received your payment."
        ) + details(
                detailRow("Booking ID", bookingId)
                        + detailRow("Payment ID", paymentId)
                        + detailRow("Amount Paid", amount)
                        + detailRow("Payment Status", "SUCCESS")
        ) + messageBox(
                "Your payment has been recorded successfully.",
                "#ecfdf5"
        );

        return layout("Payment Successful!", content);
    }

    public String cancellationEmail(
            String customerName,
            String bookingId,
            String carName,
            String refundStatus
    ) {

        String content = paragraph(
                "Hello " + customerName
                        + ", your booking has been cancelled."
        ) + details(
                detailRow("Booking ID", bookingId)
                        + detailRow("Vehicle", carName)
                        + detailRow("Booking Status", "CANCELLED")
                        + detailRow("Refund Status", refundStatus)
        ) + messageBox(
                "If a refund is applicable, its status is shown above. "
                        + "A pending refund may take additional time to process.",
                "#fff7ed"
        );

        return layout("Booking Cancelled", content);
    }

    public String refundConfirmationEmail(
            String customerName,
            String bookingId,
            String refundAmount,
            String refundId
    ) {

        String content = paragraph(
                "Hello " + customerName
                        + ", your refund has been successfully processed."
        ) + details(
                detailRow("Booking ID", bookingId)
                        + detailRow("Refund ID", refundId)
                        + detailRow("Refund Amount", refundAmount)
                        + detailRow("Refund Status", "REFUNDED")
        ) + messageBox(
                "The time taken for the refunded amount to appear in your "
                        + "account may depend on your bank or payment provider.",
                "#ecfdf5"
        );

        return layout("Refund Processed!", content);
    }

    public String refundFailureEmail(
            String customerName,
            String bookingId,
            String refundAmount,
            String refundId
    ) {

        String content = paragraph(
                "Hello " + customerName
                        + ", unfortunately, your refund could not be processed successfully."
        ) + details(
                detailRow("Booking ID", bookingId)
                        + detailRow("Refund ID", refundId)
                        + detailRow("Refund Amount", refundAmount)
                        + detailRow("Refund Status", "FAILED")
        ) + messageBox(
                "Please contact our support team for assistance with your refund. "
                        + "Your refund request may require further attention.",
                "#fff7ed"
        );

        return layout("Refund Processing Failed", content);
    }
}
