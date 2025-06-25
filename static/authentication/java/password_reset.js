document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('passwordResetForm');
  const url = form.getAttribute("data-url");

  form.addEventListener('submit', function (e) {
      e.preventDefault();

      const emailInput = document.getElementById('email');
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": csrfToken,
        },
        body: new URLSearchParams({
          email: emailInput.value,
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          document.getElementById("resetFormContainer").classList.add("d-none");
          document.getElementById("resetSuccessMessage").classList.remove("d-none");
        } else {
          alert("Email not found or an error occurred.");
        }
      })
      .catch(error => {
        console.error("Error:", error);
        alert("Something went wrong. Try again.");
      });
      
  });
});
