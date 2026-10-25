\# 🚗 Car Rental System



A full-stack web application that allows users to explore available cars, make reservations, manage bookings, and complete payments. Administrators can manage vehicle inventory and booking operations through a dedicated dashboard.



\## ✨ Features



\### 👤 User Features

\- User registration and login

\- JWT-based authentication

\- Browse available rental cars

\- Filter cars by category, brand, model, price, fuel type, and transmission

\- Check vehicle availability for selected dates

\- Book cars for a specified rental period

\- View personal booking history

\- Cancel bookings

\- Complete payments through Razorpay test-mode integration

\- View booking confirmation and payment status



\### 🛠️ Admin Features

\- Admin authentication and dashboard

\- Add, update, and manage vehicle inventory

\- Manage customer bookings

\- Review booking statuses and booking statistics

\- Manage booking operations from a centralized interface



\### 🔐 Security

\- Spring Security authentication and authorization

\- JWT-based stateless authentication

\- Password encoding

\- Protected API endpoints

\- Environment-based configuration for database and payment credentials



\## 🧰 Tech Stack



| Layer | Technologies |

|---|---|

| Frontend | React, TypeScript, Vite |

| Backend | Java 21, Spring Boot |

| Security | Spring Security, JWT |

| Database | PostgreSQL |

| ORM | Spring Data JPA, Hibernate |

| Payments | Razorpay |

| API Communication | REST APIs, Axios |

| Testing Tools | Postman |

| Build Tools | Maven, npm |



\## 📁 Project Structure



```text

car-rental-system/

├── car-rental-backend/

│   ├── src/

│   │   ├── main/

│   │   │   ├── java/com/carrental/

│   │   │   └── resources/

│   │   └── test/

│   ├── pom.xml

│   └── mvnw

├── car-rental-frontend/

│   ├── public/

│   ├── src/

│   │   ├── components/

│   │   ├── layouts/

│   │   ├── pages/

│   │   ├── services/

│   │   └── store/

│   └── package.json

├── postman/

├── .postman/

├── car.json

└── README.md

```



\## ⚙️ Prerequisites



Install the following before running the application:



\- Java 21

\- PostgreSQL

\- Node.js and npm

\- Git



\## 🚀 Getting Started



\### 1. Clone the Repository



```bash

git clone https://github.com/sridhar-varma27/car-rental-system.git

cd car-rental-system

```



\### 2. Configure PostgreSQL



Create a PostgreSQL database named:



```sql

CREATE DATABASE car\_rental\_db;

```



Make sure your PostgreSQL server is running and your database credentials are available.



\### 3. Configure Backend Environment Variables



The backend reads its database, JWT, and Razorpay configuration from environment variables.



Set the following variables in your terminal environment:



| Variable | Purpose |

|---|---|

| `DATABASE\_URL` | PostgreSQL JDBC connection URL |

| `DATABASE\_USERNAME` | PostgreSQL username |

| `DATABASE\_PASSWORD` | PostgreSQL password |

| `JWT\_SECRET` | Private secret used for JWT signing |

| `RAZORPAY\_KEY\_ID` | Razorpay API key ID |

| `RAZORPAY\_KEY\_SECRET` | Razorpay API secret |

| `PORT` | Backend port; defaults to `8082` |



Use your own credentials. Never commit real passwords, API secrets, or production credentials to GitHub.



For local development, the database URL can use this format:



```text

jdbc:postgresql://localhost:5432/car\_rental\_db

```



Set all required variables before starting the backend. The JWT secret should be a securely generated secret of sufficient length.



\### 4. Start the Backend



Open a terminal in the project root.



On Windows PowerShell:



```powershell

cd car-rental-backend

.\\mvnw.cmd spring-boot:run

```



The backend runs on:



```text

http://localhost:8082

```



The API base URL used by the frontend is:



```text

http://localhost:8082/api

```



\### 5. Start the Frontend



Open a second terminal from the project root:



```powershell

cd car-rental-frontend

npm install

npm run dev

```



Open the local URL printed by Vite in your terminal, commonly:



```text

http://localhost:5173

```



Keep both frontend and backend running while using the application.



\## 🔌 Main API Areas



The backend provides REST API functionality for:



\- \*\*Authentication:\*\* registration, login, and current-user details

\- \*\*Cars:\*\* vehicle listings, availability, and inventory management

\- \*\*Bookings:\*\* creating and managing rental reservations

\- \*\*Payments:\*\* payment records and Razorpay payment processing

\- \*\*Confirmations:\*\* booking confirmation details

\- \*\*Administration:\*\* booking management and administrative operations



All protected endpoints require appropriate authentication and authorization.



\## 💳 Payment Integration



The application integrates Razorpay for payment processing.



Use Razorpay test credentials and test-mode payment flows during development. Configure the required credentials through environment variables rather than hardcoding them.



Payment completion should be verified by the backend; never treat a frontend success message alone as proof of a successful payment.



\## 🧪 API Testing



Postman can be used to test authentication, car listings, booking operations, and payment-related endpoints.



Start the backend and use the API base URL:



```text

http://localhost:8082/api

```



Authenticated requests should include a valid bearer token where required.



\## 🔒 Security Notes



\- Never commit `.env` files, database backups, private keys, or real API secrets.

\- Use strong, private JWT signing secrets.

\- Keep Razorpay credentials private.

\- Use test credentials for development and properly configured credentials for deployment.

\- Configure production CORS, HTTPS, database access, and environment variables before deployment.





\## 👨‍💻 Author



\*\*Sridhar Varma\*\*



GitHub: \[@sridhar-varma27](https://github.com/sridhar-varma27)



\## 📄 License



No license has been specified yet. All rights are reserved unless a license is added to this repository.




## 📸 Application Screenshots

### Available Cars
![Available Cars](screenshots/cars-page-1.png)

![Available Cars - Alternative View](screenshots/cars-page-2.png)

### Login
![Login Page](screenshots/login-page.png)

### Create Account
![Create Account Page](screenshots/createaccount-page.png)

### My Bookings
![My Bookings](screenshots/mybookings-page.png)

### Car Booking
![Car Booking](screenshots/CarBooking.png)

### Admin Dashboard
![Admin Dashboard](screenshots/AdminDashboard-page.png)

### Manage Cars
![Manage Cars](screenshots/ManageCars-page.png)

### Manage Bookings
![Manage Bookings](screenshots/ManageBookings.png)


### Payment
![Payment Page](screenshots/Payment.png)
