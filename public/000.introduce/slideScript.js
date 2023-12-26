$('.slider-2 .page-nav > div').click(function() {
    
    var $this = $(this);
    var $pagenav = $this.parent()
    var $current = $pagenav.find('.active');
    
    $current.removeClass('active');
    $this.addClass('active');

    var index = $this.index();
    var $슬라이더 = $this.closest('.slider-2');
    
    $슬라이더.find('.slides > div.active').removeClass('active');
    $슬라이더.find('.slides > div').eq(index).addClass('active');
    
    
});

$('.slider-2 > .side-btns > div:first-child').click(function() {
    var $this = $(this);
    var $slider = $this.closest('.slider-2');
    
    var $current = $slider.find('.page-nav > div.active');
    var $post = $current.prev();
    
    if ( $post.length == 0 ) {
        $post = $slider.find('.page-nav > div:last-child');
    }
    
    $post.click();
});

$('.slider-2 > .side-btns > div:last-child').click(function() {
    var $this = $(this);
    var $slider = $this.closest('.slider-2');
    
    var $current = $slider.find('.page-nav > div.active');
    var $post = $current.next();
    
    if ( $post.length == 0 ) {
        $post = $slider.find('.page-nav > div:first-child');
    }
    
    $post.click();
});