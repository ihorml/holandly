$('.form-signin').submit(function (event) {
    console.log('login');
    let data = {'username': $('#inputLogin').val(), 'password': $('#inputPassword').val()};
    console.log(data);
    $.ajax({
        type: "post",
        url: '/edit/login',
        dataType: 'html',
        data: JSON.stringify(data),
        contentType: 'application/json',
        success: function (data, textStatus, request) {
            $.ajax({
                type: "get",
                url: "/edit",
                dataType: "html",
                success: function (data, textStatus, request) {
                    window.location = "/edit";
                }
            })
        }
    });
});
